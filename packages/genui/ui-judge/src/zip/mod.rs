// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::collections::HashMap;
use std::fmt;
use std::fs::{self, File, OpenOptions};
use std::io::{Cursor, Read, Seek, SeekFrom, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, LazyLock};
use std::time::{Duration, Instant};

use ::zip::read::{ArchiveOffset, Config};
use ::zip::ZipArchive;
use tempfile::{Builder, TempDir};
use thiserror::Error;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

/// Maximum accepted ZIP upload size. HTTP upload code must enforce this while
/// streaming the request body, before allocating the `Vec` passed to
/// [`extract_uploaded_zip`].
pub const MAX_ZIP_UPLOAD_BYTES: usize = 10 * 1024 * 1024;
const MAX_ZIP_ENTRIES: usize = 100;
const MAX_SINGLE_FILE_BYTES: u64 = 50 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES: u64 = 100 * 1024 * 1024;
const MAX_COMPRESSION_RATIO: u64 = 100;
const MAX_PATH_DEPTH: usize = 20;
const MAX_FILE_NAME_BYTES: usize = 255;
const MAX_RELATIVE_PATH_BYTES: usize = 4_096;
const COPY_BUFFER_BYTES: usize = 64 * 1024;
const EXTRACTION_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_CONCURRENT_EXTRACTIONS: usize = 4;

static EXTRACTION_PERMITS: LazyLock<Arc<Semaphore>> =
  LazyLock::new(|| Arc::new(Semaphore::new(MAX_CONCURRENT_EXTRACTIONS)));

#[derive(Clone, Copy, Debug)]
struct ExtractionLimits {
  max_upload_bytes: usize,
  max_entries: usize,
  max_single_file_bytes: u64,
  max_total_uncompressed_bytes: u64,
  max_compression_ratio: u64,
  max_path_depth: usize,
  max_file_name_bytes: usize,
  max_relative_path_bytes: usize,
}

const PRODUCTION_LIMITS: ExtractionLimits = ExtractionLimits {
  max_upload_bytes: MAX_ZIP_UPLOAD_BYTES,
  max_entries: MAX_ZIP_ENTRIES,
  max_single_file_bytes: MAX_SINGLE_FILE_BYTES,
  max_total_uncompressed_bytes: MAX_TOTAL_UNCOMPRESSED_BYTES,
  max_compression_ratio: MAX_COMPRESSION_RATIO,
  max_path_depth: MAX_PATH_DEPTH,
  max_file_name_bytes: MAX_FILE_NAME_BYTES,
  max_relative_path_bytes: MAX_RELATIVE_PATH_BYTES,
};

/// Sanitized extraction telemetry. It deliberately contains no archive entry
/// names, so callers can safely attach it to rejection metrics.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ZipExtractionStats {
  pub archive_bytes: u64,
  pub entry_count: usize,
  pub declared_uncompressed_bytes: u64,
  pub actual_uncompressed_bytes: u64,
  pub elapsed: Duration,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ZipRejectionKind {
  UploadTooLarge,
  InvalidArchive,
  TooManyEntries,
  OverlappingEntries,
  UnsafePath,
  PathTooDeep,
  FileNameTooLong,
  PathTooLong,
  DuplicatePath,
  ConflictingPath,
  EncryptedEntry,
  UnsupportedEntryType,
  FileTooLarge,
  ArchiveTooLarge,
  CompressionRatioTooHigh,
  OutputCollision,
  OutputIo,
  IntegrityCheckFailed,
  TimedOut,
  WorkerFailed,
}

impl fmt::Display for ZipRejectionKind {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    formatter.write_str(match self {
      Self::UploadTooLarge => "upload-too-large",
      Self::InvalidArchive => "invalid-archive",
      Self::TooManyEntries => "too-many-entries",
      Self::OverlappingEntries => "overlapping-entries",
      Self::UnsafePath => "unsafe-path",
      Self::PathTooDeep => "path-too-deep",
      Self::FileNameTooLong => "file-name-too-long",
      Self::PathTooLong => "path-too-long",
      Self::DuplicatePath => "duplicate-path",
      Self::ConflictingPath => "conflicting-path",
      Self::EncryptedEntry => "encrypted-entry",
      Self::UnsupportedEntryType => "unsupported-entry-type",
      Self::FileTooLarge => "file-too-large",
      Self::ArchiveTooLarge => "archive-too-large",
      Self::CompressionRatioTooHigh => "compression-ratio-too-high",
      Self::OutputCollision => "output-collision",
      Self::OutputIo => "output-io",
      Self::IntegrityCheckFailed => "integrity-check-failed",
      Self::TimedOut => "timed-out",
      Self::WorkerFailed => "worker-failed",
    })
  }
}

#[derive(Debug, Error)]
#[error("ZIP extraction rejected ({kind})")]
pub struct ZipExtractionError {
  pub kind: ZipRejectionKind,
  pub stats: ZipExtractionStats,
  /// A failed cleanup is operationally important, but the rejection kind is
  /// retained so security metrics do not lose the original reason.
  pub cleanup_failed: bool,
}

/// Owns one complete staged extraction. Keep this guard alive until headless
/// navigation, interactions, and capture have all finished; dropping it removes
/// the directory recursively.
#[derive(Debug)]
pub struct ExtractedZip {
  directory: TempDir,
  stats: ZipExtractionStats,
}

impl ExtractedZip {
  pub fn path(&self) -> &Path {
    self.directory.path()
  }

  pub fn stats(&self) -> &ZipExtractionStats {
    &self.stats
  }
}

#[derive(Debug)]
struct ExtractionProgress {
  archive_bytes: u64,
  entry_count: AtomicUsize,
  declared_uncompressed_bytes: AtomicU64,
  actual_uncompressed_bytes: AtomicU64,
  started_at: Instant,
}

impl ExtractionProgress {
  fn new(archive_bytes: usize) -> Self {
    Self {
      archive_bytes: archive_bytes as u64,
      entry_count: AtomicUsize::new(0),
      declared_uncompressed_bytes: AtomicU64::new(0),
      actual_uncompressed_bytes: AtomicU64::new(0),
      started_at: Instant::now(),
    }
  }

  fn snapshot(&self) -> ZipExtractionStats {
    ZipExtractionStats {
      archive_bytes: self.archive_bytes,
      entry_count: self.entry_count.load(Ordering::Relaxed),
      declared_uncompressed_bytes: self.declared_uncompressed_bytes.load(Ordering::Relaxed),
      actual_uncompressed_bytes: self.actual_uncompressed_bytes.load(Ordering::Relaxed),
      elapsed: self.started_at.elapsed(),
    }
  }

  fn reject(&self, kind: ZipRejectionKind) -> ZipExtractionError {
    ZipExtractionError {
      kind,
      stats: self.snapshot(),
      cleanup_failed: false,
    }
  }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum EntryKind {
  Directory,
  File,
}

#[derive(Debug)]
struct EntryPlan {
  compressed_size: u64,
  declared_size: u64,
  index: usize,
  kind: EntryKind,
  path: PathBuf,
}

#[derive(Debug)]
struct ArchivePlan {
  compressed_file_bytes: u64,
  entries: Vec<EntryPlan>,
}

#[derive(Debug)]
struct OuterArchiveMetadata {
  archive_offset: u64,
  central_directory_start: u64,
  entry_count: usize,
}

/// During metadata parsing, hide local headers and file data from zip's EOCD
/// fallback scanner. This prevents an EOCD inside an ordinary nested ZIP from
/// being mistaken for the outer archive if the outer metadata is malformed.
/// Once metadata parsing succeeds, the same reader exposes the original bytes
/// for CRC-checked extraction.
#[derive(Debug)]
struct MetadataIsolatingReader {
  inner: Cursor<Vec<u8>>,
  hidden_prefix_bytes: u64,
  isolate_metadata: Arc<AtomicBool>,
}

impl Read for MetadataIsolatingReader {
  fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
    if !self.isolate_metadata.load(Ordering::Relaxed) {
      return self.inner.read(buffer);
    }

    let position = self.inner.position();
    if position >= self.hidden_prefix_bytes {
      return self.inner.read(buffer);
    }
    let remaining_file_bytes = (self.inner.get_ref().len() as u64).saturating_sub(position);
    let hidden_bytes = self.hidden_prefix_bytes.saturating_sub(position);
    let read = buffer
      .len()
      .min(remaining_file_bytes as usize)
      .min(hidden_bytes as usize);
    buffer[..read].fill(0);
    self.inner.set_position(position + read as u64);
    Ok(read)
  }
}

impl Seek for MetadataIsolatingReader {
  fn seek(&mut self, position: SeekFrom) -> std::io::Result<u64> {
    self.inner.seek(position)
  }
}

async fn acquire_extraction_slot(
  permits: Arc<Semaphore>,
  deadline: Instant,
  progress: &ExtractionProgress,
) -> Result<OwnedSemaphorePermit, ZipExtractionError> {
  match tokio::time::timeout_at(
    tokio::time::Instant::from_std(deadline),
    permits.acquire_owned(),
  )
  .await
  {
    Ok(Ok(permit)) => Ok(permit),
    Ok(Err(_)) => Err(progress.reject(ZipRejectionKind::WorkerFailed)),
    Err(_) => Err(progress.reject(ZipRejectionKind::TimedOut)),
  }
}

/// Validates and extracts one untrusted upload on the blocking pool. At most
/// four extractions run concurrently; additional callers wait asynchronously
/// within the same ten-second extraction deadline.
pub async fn extract_uploaded_zip(upload: Vec<u8>) -> Result<ExtractedZip, ZipExtractionError> {
  let progress = Arc::new(ExtractionProgress::new(upload.len()));
  if upload.len() > PRODUCTION_LIMITS.max_upload_bytes {
    return Err(progress.reject(ZipRejectionKind::UploadTooLarge));
  }
  let deadline = Instant::now() + EXTRACTION_TIMEOUT;
  let permit =
    acquire_extraction_slot(Arc::clone(&EXTRACTION_PERMITS), deadline, &progress).await?;
  let tokio_deadline = tokio::time::Instant::from_std(deadline);
  let worker_progress = Arc::clone(&progress);
  let mut worker = tokio::task::spawn_blocking(move || {
    let _permit = permit;
    extract_zip_sync(upload, PRODUCTION_LIMITS, deadline, worker_progress, None)
  });

  match tokio::time::timeout_at(tokio_deadline, &mut worker).await {
    Ok(Ok(result)) => result,
    Ok(Err(_)) => Err(progress.reject(ZipRejectionKind::WorkerFailed)),
    Err(_) => {
      // This cancels a queued blocking task. A task that has already started
      // cannot be force-cancelled; it owns the permit and checks the same
      // absolute deadline between entries, reads, and writes.
      worker.abort();
      Err(progress.reject(ZipRejectionKind::TimedOut))
    }
  }
}

fn extract_zip_sync(
  upload: Vec<u8>,
  limits: ExtractionLimits,
  deadline: Instant,
  progress: Arc<ExtractionProgress>,
  temp_parent: Option<&Path>,
) -> Result<ExtractedZip, ZipExtractionError> {
  check_deadline(deadline, &progress)?;
  if upload.len() > limits.max_upload_bytes {
    return Err(progress.reject(ZipRejectionKind::UploadTooLarge));
  }
  let outer = validate_outer_archive(&upload, limits.max_entries, deadline, &progress)?;
  let isolate_metadata = Arc::new(AtomicBool::new(true));
  let reader = MetadataIsolatingReader {
    inner: Cursor::new(upload),
    hidden_prefix_bytes: outer.central_directory_start,
    isolate_metadata: Arc::clone(&isolate_metadata),
  };
  let mut archive = ZipArchive::with_config(
    Config {
      archive_offset: ArchiveOffset::Known(outer.archive_offset),
    },
    reader,
  )
  .map_err(|_| progress.reject(ZipRejectionKind::InvalidArchive))?;
  isolate_metadata.store(false, Ordering::Relaxed);
  if archive.central_directory_start() != outer.central_directory_start
    || archive.offset() != outer.archive_offset
  {
    return Err(progress.reject(ZipRejectionKind::InvalidArchive));
  }
  let plan = inspect_archive(&mut archive, outer.entry_count, limits, deadline, &progress)?;
  check_deadline(deadline, &progress)?;

  let directory = create_staging_directory(temp_parent, &progress)?;
  let extraction = extract_archive(
    &mut archive,
    &plan,
    directory.path(),
    limits,
    deadline,
    &progress,
  );
  finish_staged_extraction(directory, extraction, &progress)
}

fn validate_outer_archive(
  archive: &[u8],
  max_entries: usize,
  deadline: Instant,
  progress: &ExtractionProgress,
) -> Result<OuterArchiveMetadata, ZipExtractionError> {
  const END_RECORD_BYTES: usize = 22;
  const END_SIGNATURE: &[u8; 4] = b"PK\x05\x06";
  const MAX_COMMENT_BYTES: usize = u16::MAX as usize;

  let latest_start = archive
    .len()
    .checked_sub(END_RECORD_BYTES)
    .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
  let earliest_start = archive
    .len()
    .saturating_sub(END_RECORD_BYTES + MAX_COMMENT_BYTES);
  let mut selected_record = None;
  for offset in (earliest_start..=latest_start).rev() {
    if offset % 4_096 == 0 {
      check_deadline(deadline, progress)?;
    }
    let signature_end = offset
      .checked_add(END_SIGNATURE.len())
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    if archive.get(offset..signature_end) != Some(END_SIGNATURE) {
      continue;
    }
    let record_end = offset
      .checked_add(END_RECORD_BYTES)
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    let Some(record) = archive.get(offset..record_end) else {
      continue;
    };
    let comment_bytes = u16::from_le_bytes([record[20], record[21]]) as usize;
    let Some(comment_end) = record_end.checked_add(comment_bytes) else {
      continue;
    };
    if comment_end != archive.len() {
      continue;
    }
    let disk_number = u16::from_le_bytes([record[4], record[5]]);
    let central_directory_disk = u16::from_le_bytes([record[6], record[7]]);
    let entries_on_disk = u16::from_le_bytes([record[8], record[9]]);
    let total_entries = u16::from_le_bytes([record[10], record[11]]);
    let central_directory_size =
      u32::from_le_bytes([record[12], record[13], record[14], record[15]]);
    let central_directory_offset =
      u32::from_le_bytes([record[16], record[17], record[18], record[19]]);
    // Reject ZIP64 before `ZipArchive::with_config`: otherwise the classic EOCD
    // can advertise a small count while ZIP64 metadata drives a large parse
    // before our structural 100-entry check runs.
    if entries_on_disk == u16::MAX
      || total_entries == u16::MAX
      || central_directory_size == u32::MAX
      || central_directory_offset == u32::MAX
    {
      return Err(progress.reject(ZipRejectionKind::InvalidArchive));
    }
    if disk_number != 0 || central_directory_disk != 0 || entries_on_disk != total_entries {
      return Err(progress.reject(ZipRejectionKind::InvalidArchive));
    }
    progress
      .entry_count
      .store(total_entries as usize, Ordering::Relaxed);
    if total_entries as usize > max_entries {
      return Err(progress.reject(ZipRejectionKind::TooManyEntries));
    }
    selected_record = Some((
      offset,
      total_entries as usize,
      central_directory_size as usize,
      central_directory_offset as usize,
    ));
    // The rightmost strict-EOF record is the only outer candidate. Earlier
    // records can belong to nested ZIP bytes in the hidden file-data prefix.
    break;
  }
  let (end_record_offset, advertised_entries, central_directory_bytes, relative_directory_start) =
    selected_record.ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
  let central_directory_start = end_record_offset
    .checked_sub(central_directory_bytes)
    .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
  let archive_offset = central_directory_start
    .checked_sub(relative_directory_start)
    .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;

  // The metadata-only reader hides everything before the outer central
  // directory. Reject additional EOCD signatures in its visible range so the
  // zip crate cannot fall back to attacker-controlled metadata if parsing the
  // selected outer record fails. EOCD bytes inside ordinary file data remain
  // valid and are hidden only during metadata parsing.
  if archive[central_directory_start..]
    .windows(END_SIGNATURE.len())
    .enumerate()
    .any(|(relative_offset, candidate)| {
      candidate == END_SIGNATURE && central_directory_start + relative_offset != end_record_offset
    })
  {
    return Err(progress.reject(ZipRejectionKind::InvalidArchive));
  }

  let structural_entries = count_central_directory_entries(
    archive,
    central_directory_start as u64,
    end_record_offset as u64,
    archive_offset as u64,
    max_entries,
    deadline,
    progress,
  )?;
  if structural_entries != advertised_entries {
    return Err(progress.reject(ZipRejectionKind::InvalidArchive));
  }

  Ok(OuterArchiveMetadata {
    archive_offset: archive_offset as u64,
    central_directory_start: central_directory_start as u64,
    entry_count: structural_entries,
  })
}

fn finish_staged_extraction(
  directory: TempDir,
  extraction: Result<(), ZipExtractionError>,
  progress: &ExtractionProgress,
) -> Result<ExtractedZip, ZipExtractionError> {
  match extraction {
    Ok(()) => Ok(ExtractedZip {
      directory,
      stats: progress.snapshot(),
    }),
    Err(mut error) => {
      if directory.close().is_err() {
        error.cleanup_failed = true;
      }
      Err(error)
    }
  }
}

fn inspect_archive<R: Read + Seek>(
  archive: &mut ZipArchive<R>,
  central_entry_count: usize,
  limits: ExtractionLimits,
  deadline: Instant,
  progress: &ExtractionProgress,
) -> Result<ArchivePlan, ZipExtractionError> {
  progress
    .entry_count
    .store(central_entry_count, Ordering::Relaxed);
  if central_entry_count > limits.max_entries {
    return Err(progress.reject(ZipRejectionKind::TooManyEntries));
  }
  // zip stores entries in an IndexMap keyed by the raw name. Comparing its
  // retained length with the validated central-directory count catches exact
  // duplicate names that the map would otherwise replace silently.
  if central_entry_count != archive.len() {
    return Err(progress.reject(ZipRejectionKind::DuplicatePath));
  }
  if archive
    .has_overlapping_files()
    .map_err(|_| progress.reject(ZipRejectionKind::InvalidArchive))?
  {
    return Err(progress.reject(ZipRejectionKind::OverlappingEntries));
  }

  let entry_count = archive.len();
  let mut seen_paths = HashMap::with_capacity(entry_count);
  let mut compressed_file_bytes = 0_u64;
  let mut declared_total = 0_u64;
  let mut entries = Vec::with_capacity(entry_count);
  for index in 0..entry_count {
    check_deadline(deadline, progress)?;
    let entry = archive
      .by_index_raw(index)
      .map_err(|_| progress.reject(ZipRejectionKind::InvalidArchive))?;
    let declared_size = entry.size();
    declared_total = declared_total
      .checked_add(declared_size)
      .ok_or_else(|| progress.reject(ZipRejectionKind::ArchiveTooLarge))?;
    progress
      .declared_uncompressed_bytes
      .store(declared_total, Ordering::Relaxed);

    if entry.encrypted() {
      return Err(progress.reject(ZipRejectionKind::EncryptedEntry));
    }
    let path = validate_entry_path(entry.name_raw(), entry.enclosed_name(), limits, progress)?;

    let unix_file_type = entry.unix_mode().unwrap_or(0) & 0o170_000;
    let kind = if entry.is_symlink() {
      return Err(progress.reject(ZipRejectionKind::UnsupportedEntryType));
    } else if entry.is_dir() && matches!(unix_file_type, 0 | 0o040_000) {
      if declared_size != 0 || entry.compressed_size() != 0 {
        return Err(progress.reject(ZipRejectionKind::UnsupportedEntryType));
      }
      EntryKind::Directory
    } else if entry.is_file() && matches!(unix_file_type, 0 | 0o100_000) {
      EntryKind::File
    } else {
      return Err(progress.reject(ZipRejectionKind::UnsupportedEntryType));
    };
    validate_path_conflicts(&seen_paths, &path, kind, progress)?;
    seen_paths.insert(path.clone(), kind);

    if kind == EntryKind::File {
      compressed_file_bytes = compressed_file_bytes
        .checked_add(entry.compressed_size())
        .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
      if declared_size > limits.max_single_file_bytes {
        return Err(progress.reject(ZipRejectionKind::FileTooLarge));
      }
      if exceeds_ratio(
        declared_size,
        entry.compressed_size(),
        limits.max_compression_ratio,
      ) {
        return Err(progress.reject(ZipRejectionKind::CompressionRatioTooHigh));
      }
    }
    if declared_total > limits.max_total_uncompressed_bytes {
      return Err(progress.reject(ZipRejectionKind::ArchiveTooLarge));
    }

    entries.push(EntryPlan {
      compressed_size: entry.compressed_size(),
      declared_size,
      index,
      kind,
      path,
    });
  }

  if exceeds_ratio(
    declared_total,
    compressed_file_bytes,
    limits.max_compression_ratio,
  ) || exceeds_ratio(
    declared_total,
    progress.archive_bytes,
    limits.max_compression_ratio,
  ) {
    return Err(progress.reject(ZipRejectionKind::CompressionRatioTooHigh));
  }
  Ok(ArchivePlan {
    compressed_file_bytes,
    entries,
  })
}

fn count_central_directory_entries(
  archive: &[u8],
  central_directory_start: u64,
  central_directory_end: u64,
  archive_offset: u64,
  max_entries: usize,
  deadline: Instant,
  progress: &ExtractionProgress,
) -> Result<usize, ZipExtractionError> {
  const CENTRAL_HEADER_BYTES: usize = 46;
  const CENTRAL_SIGNATURE: &[u8; 4] = b"PK\x01\x02";
  const LOCAL_HEADER_BYTES: usize = 30;
  const LOCAL_SIGNATURE: &[u8; 4] = b"PK\x03\x04";
  const ZIP64_SENTINEL: u32 = u32::MAX;

  let central_directory_start = usize::try_from(central_directory_start)
    .map_err(|_| progress.reject(ZipRejectionKind::InvalidArchive))?;
  let central_directory_end = usize::try_from(central_directory_end)
    .map_err(|_| progress.reject(ZipRejectionKind::InvalidArchive))?;
  if central_directory_start > central_directory_end || central_directory_end > archive.len() {
    return Err(progress.reject(ZipRejectionKind::InvalidArchive));
  }
  let mut offset = central_directory_start;
  let mut count = 0_usize;
  loop {
    check_deadline(deadline, progress)?;
    let signature_end = offset
      .checked_add(CENTRAL_SIGNATURE.len())
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    if archive.get(offset..signature_end) != Some(CENTRAL_SIGNATURE) {
      break;
    }
    let header_end = offset
      .checked_add(CENTRAL_HEADER_BYTES)
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    let header = archive
      .get(offset..header_end)
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    let file_name_bytes = u16::from_le_bytes([header[28], header[29]]) as usize;
    let extra_field_bytes = u16::from_le_bytes([header[30], header[31]]) as usize;
    let comment_bytes = u16::from_le_bytes([header[32], header[33]]) as usize;
    let compressed_bytes = u32::from_le_bytes([header[20], header[21], header[22], header[23]]);
    let uncompressed_bytes = u32::from_le_bytes([header[24], header[25], header[26], header[27]]);
    let local_header_offset = u32::from_le_bytes([header[42], header[43], header[44], header[45]]);
    if compressed_bytes == ZIP64_SENTINEL
      || uncompressed_bytes == ZIP64_SENTINEL
      || local_header_offset == ZIP64_SENTINEL
    {
      return Err(progress.reject(ZipRejectionKind::InvalidArchive));
    }

    let entry_bytes = CENTRAL_HEADER_BYTES
      .checked_add(file_name_bytes)
      .and_then(|size| size.checked_add(extra_field_bytes))
      .and_then(|size| size.checked_add(comment_bytes))
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    let entry_end = offset
      .checked_add(entry_bytes)
      .filter(|end| *end <= central_directory_end)
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    let central_extra_start = header_end
      .checked_add(file_name_bytes)
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    let central_extra_end = central_extra_start
      .checked_add(extra_field_bytes)
      .filter(|end| *end <= entry_end)
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    validate_extra_fields(&archive[central_extra_start..central_extra_end], progress)?;

    let local_header_offset = archive_offset
      .checked_add(local_header_offset as u64)
      .and_then(|value| usize::try_from(value).ok())
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    let local_header_end = local_header_offset
      .checked_add(LOCAL_HEADER_BYTES)
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    let local_header = archive
      .get(local_header_offset..local_header_end)
      .filter(|header| header.starts_with(LOCAL_SIGNATURE))
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    let local_name_bytes = u16::from_le_bytes([local_header[26], local_header[27]]) as usize;
    let local_extra_bytes = u16::from_le_bytes([local_header[28], local_header[29]]) as usize;
    let local_extra_start = local_header_end
      .checked_add(local_name_bytes)
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    let data_start = local_extra_start
      .checked_add(local_extra_bytes)
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    let local_extra = archive
      .get(local_extra_start..data_start)
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    validate_extra_fields(local_extra, progress)?;
    let data_end = data_start
      .checked_add(compressed_bytes as usize)
      .filter(|end| *end <= central_directory_end)
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    if data_end > central_directory_start {
      return Err(progress.reject(ZipRejectionKind::InvalidArchive));
    }

    offset = entry_end;
    count = count
      .checked_add(1)
      .ok_or_else(|| progress.reject(ZipRejectionKind::TooManyEntries))?;
    progress.entry_count.store(count, Ordering::Relaxed);
    if count > max_entries {
      return Err(progress.reject(ZipRejectionKind::TooManyEntries));
    }
  }
  if offset != central_directory_end {
    return Err(progress.reject(ZipRejectionKind::InvalidArchive));
  }
  Ok(count)
}

fn validate_extra_fields(
  extra_fields: &[u8],
  progress: &ExtractionProgress,
) -> Result<(), ZipExtractionError> {
  const ZIP64_EXTRA_FIELD: u16 = 0x0001;
  const EXTRA_FIELD_HEADER_BYTES: usize = 4;

  let mut offset = 0;
  while offset < extra_fields.len() {
    let header_end = offset
      .checked_add(EXTRA_FIELD_HEADER_BYTES)
      .filter(|end| *end <= extra_fields.len())
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    let kind = u16::from_le_bytes([extra_fields[offset], extra_fields[offset + 1]]);
    let data_bytes =
      u16::from_le_bytes([extra_fields[offset + 2], extra_fields[offset + 3]]) as usize;
    let field_end = header_end
      .checked_add(data_bytes)
      .filter(|end| *end <= extra_fields.len())
      .ok_or_else(|| progress.reject(ZipRejectionKind::InvalidArchive))?;
    if kind == ZIP64_EXTRA_FIELD {
      return Err(progress.reject(ZipRejectionKind::InvalidArchive));
    }
    offset = field_end;
  }
  Ok(())
}

fn validate_entry_path(
  raw_name: &[u8],
  enclosed_name: Option<PathBuf>,
  limits: ExtractionLimits,
  progress: &ExtractionProgress,
) -> Result<PathBuf, ZipExtractionError> {
  let raw_path = raw_name.strip_suffix(b"/").unwrap_or(raw_name);
  if raw_path.is_empty()
    || raw_name.contains(&b'\\')
    || raw_path
      .split(|byte| *byte == b'/')
      .any(|part| part.is_empty() || part == b"." || part == b"..")
  {
    return Err(progress.reject(ZipRejectionKind::UnsafePath));
  }
  if raw_name.len() > limits.max_relative_path_bytes {
    return Err(progress.reject(ZipRejectionKind::PathTooLong));
  }
  if raw_path
    .split(|byte| *byte == b'/')
    .any(|part| part.len() > limits.max_file_name_bytes)
  {
    return Err(progress.reject(ZipRejectionKind::FileNameTooLong));
  }

  let path = enclosed_name.ok_or_else(|| progress.reject(ZipRejectionKind::UnsafePath))?;
  let mut depth = 0;
  for component in path.components() {
    let Component::Normal(name) = component else {
      return Err(progress.reject(ZipRejectionKind::UnsafePath));
    };
    depth += 1;
    if name.as_encoded_bytes().len() > limits.max_file_name_bytes {
      return Err(progress.reject(ZipRejectionKind::FileNameTooLong));
    }
  }
  if depth == 0 {
    return Err(progress.reject(ZipRejectionKind::UnsafePath));
  }
  if depth > limits.max_path_depth {
    return Err(progress.reject(ZipRejectionKind::PathTooDeep));
  }
  if path.as_os_str().as_encoded_bytes().len() > limits.max_relative_path_bytes {
    return Err(progress.reject(ZipRejectionKind::PathTooLong));
  }
  Ok(path)
}

fn validate_path_conflicts(
  seen_paths: &HashMap<PathBuf, EntryKind>,
  path: &Path,
  kind: EntryKind,
  progress: &ExtractionProgress,
) -> Result<(), ZipExtractionError> {
  if seen_paths.contains_key(path) {
    return Err(progress.reject(ZipRejectionKind::DuplicatePath));
  }
  if path
    .ancestors()
    .skip(1)
    .any(|ancestor| seen_paths.get(ancestor) == Some(&EntryKind::File))
    || (kind == EntryKind::File && seen_paths.keys().any(|existing| existing.starts_with(path)))
  {
    return Err(progress.reject(ZipRejectionKind::ConflictingPath));
  }
  Ok(())
}

fn extract_archive<R: Read + Seek>(
  archive: &mut ZipArchive<R>,
  plan: &ArchivePlan,
  root: &Path,
  limits: ExtractionLimits,
  deadline: Instant,
  progress: &ExtractionProgress,
) -> Result<(), ZipExtractionError> {
  for planned_entry in &plan.entries {
    check_deadline(deadline, progress)?;
    let destination = root.join(&planned_entry.path);
    match planned_entry.kind {
      EntryKind::Directory => ensure_directory(&destination, progress)?,
      EntryKind::File => {
        if let Some(parent) = destination.parent() {
          ensure_directory(parent, progress)?;
        }
        let mut output = open_new_file(&destination, progress)?;
        let mut entry = archive
          .by_index(planned_entry.index)
          .map_err(|_| progress.reject(ZipRejectionKind::IntegrityCheckFailed))?;
        stream_entry(
          &mut entry,
          &mut output,
          planned_entry.compressed_size,
          planned_entry.declared_size,
          plan.compressed_file_bytes,
          limits,
          deadline,
          progress,
        )?;
      }
    }
  }
  check_deadline(deadline, progress)
}

fn stream_entry<R: Read, W: Write>(
  reader: &mut R,
  writer: &mut W,
  compressed_size: u64,
  declared_size: u64,
  archive_compressed_bytes: u64,
  limits: ExtractionLimits,
  deadline: Instant,
  progress: &ExtractionProgress,
) -> Result<(), ZipExtractionError> {
  let mut buffer = [0_u8; COPY_BUFFER_BYTES];
  let mut file_written = 0_u64;
  loop {
    check_deadline(deadline, progress)?;
    let read = reader
      .read(&mut buffer)
      .map_err(|_| progress.reject(ZipRejectionKind::IntegrityCheckFailed))?;
    if read == 0 {
      break;
    }
    let next_file_size = file_written
      .checked_add(read as u64)
      .ok_or_else(|| progress.reject(ZipRejectionKind::FileTooLarge))?;
    if next_file_size > limits.max_single_file_bytes {
      return Err(progress.reject(ZipRejectionKind::FileTooLarge));
    }
    if exceeds_ratio(
      next_file_size,
      compressed_size,
      limits.max_compression_ratio,
    ) {
      return Err(progress.reject(ZipRejectionKind::CompressionRatioTooHigh));
    }
    let next_total_size = progress
      .actual_uncompressed_bytes
      .load(Ordering::Relaxed)
      .checked_add(read as u64)
      .ok_or_else(|| progress.reject(ZipRejectionKind::ArchiveTooLarge))?;
    if next_total_size > limits.max_total_uncompressed_bytes {
      return Err(progress.reject(ZipRejectionKind::ArchiveTooLarge));
    }
    if exceeds_ratio(
      next_total_size,
      archive_compressed_bytes,
      limits.max_compression_ratio,
    ) || exceeds_ratio(
      next_total_size,
      progress.archive_bytes,
      limits.max_compression_ratio,
    ) {
      return Err(progress.reject(ZipRejectionKind::CompressionRatioTooHigh));
    }

    let mut offset = 0;
    while offset < read {
      check_deadline(deadline, progress)?;
      let written = writer
        .write(&buffer[offset..read])
        .map_err(|_| progress.reject(ZipRejectionKind::OutputIo))?;
      if written == 0 {
        return Err(progress.reject(ZipRejectionKind::OutputIo));
      }
      offset += written;
      file_written += written as u64;
      progress
        .actual_uncompressed_bytes
        .fetch_add(written as u64, Ordering::Relaxed);
    }
  }

  if file_written != declared_size {
    return Err(progress.reject(ZipRejectionKind::IntegrityCheckFailed));
  }
  Ok(())
}

fn create_staging_directory(
  temp_parent: Option<&Path>,
  progress: &ExtractionProgress,
) -> Result<TempDir, ZipExtractionError> {
  let mut builder = Builder::new();
  builder.prefix("ui-judge-unzip-");

  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;

    builder.permissions(fs::Permissions::from_mode(0o700));
  }

  let directory = match temp_parent {
    Some(parent) => builder.tempdir_in(parent),
    None => builder.tempdir(),
  }
  .map_err(|_| progress.reject(ZipRejectionKind::OutputIo))?;
  Ok(directory)
}

fn ensure_directory(
  directory: &Path,
  progress: &ExtractionProgress,
) -> Result<(), ZipExtractionError> {
  match fs::create_dir_all(directory) {
    Ok(()) => Ok(()),
    Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
      Err(progress.reject(ZipRejectionKind::OutputCollision))
    }
    Err(_) => Err(progress.reject(ZipRejectionKind::OutputIo)),
  }
}

fn open_new_file(path: &Path, progress: &ExtractionProgress) -> Result<File, ZipExtractionError> {
  match OpenOptions::new().write(true).create_new(true).open(path) {
    Ok(file) => Ok(file),
    Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
      Err(progress.reject(ZipRejectionKind::OutputCollision))
    }
    Err(_) => Err(progress.reject(ZipRejectionKind::OutputIo)),
  }
}

fn exceeds_ratio(uncompressed: u64, compressed: u64, max_ratio: u64) -> bool {
  uncompressed > compressed.saturating_mul(max_ratio)
}

fn check_deadline(
  deadline: Instant,
  progress: &ExtractionProgress,
) -> Result<(), ZipExtractionError> {
  if Instant::now() >= deadline {
    Err(progress.reject(ZipRejectionKind::TimedOut))
  } else {
    Ok(())
  }
}

#[cfg(test)]
mod tests {
  use std::io;

  use ::zip::write::SimpleFileOptions;
  use ::zip::{CompressionMethod, ZipWriter};

  use super::*;

  enum TestEntry<'a> {
    Directory(&'a str),
    File(&'a str, &'a [u8]),
  }

  fn make_archive(entries: &[TestEntry<'_>]) -> Vec<u8> {
    make_archive_with_method(entries, CompressionMethod::Stored)
  }

  fn make_archive_with_method(entries: &[TestEntry<'_>], method: CompressionMethod) -> Vec<u8> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    for entry in entries {
      let options = SimpleFileOptions::default().compression_method(method);
      match entry {
        TestEntry::Directory(name) => writer
          .add_directory(*name, options)
          .expect("add a test directory"),
        TestEntry::File(name, contents) => {
          writer.start_file(*name, options).expect("add a test file");
          writer.write_all(contents).expect("write a test file");
        }
      }
    }
    writer.finish().expect("finish the test ZIP").into_inner()
  }

  fn make_many_files(count: usize) -> Vec<u8> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    for index in 0..count {
      writer
        .start_file(
          format!("file-{index:03}.txt"),
          SimpleFileOptions::default().compression_method(CompressionMethod::Stored),
        )
        .expect("add a numbered test file");
    }
    writer.finish().expect("finish the test ZIP").into_inner()
  }

  fn signature_offsets(bytes: &[u8], signature: &[u8; 4]) -> Vec<usize> {
    bytes
      .windows(signature.len())
      .enumerate()
      .filter_map(|(offset, candidate)| (candidate == signature).then_some(offset))
      .collect()
  }

  fn read_u16(bytes: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes(bytes[offset..offset + 2].try_into().expect("two bytes"))
  }

  fn read_u32(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(bytes[offset..offset + 4].try_into().expect("four bytes"))
  }

  fn write_u16(bytes: &mut [u8], offset: usize, value: u16) {
    bytes[offset..offset + 2].copy_from_slice(&value.to_le_bytes());
  }

  fn write_u32(bytes: &mut [u8], offset: usize, value: u32) {
    bytes[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
  }

  fn set_advertised_entry_count(bytes: &mut [u8], count: u16) {
    let end_record = *signature_offsets(bytes, b"PK\x05\x06")
      .last()
      .expect("end record");
    write_u16(bytes, end_record + 8, count);
    write_u16(bytes, end_record + 10, count);
  }

  fn mark_classic_end_record_as_zip64(bytes: &mut [u8]) {
    let end_record = *signature_offsets(bytes, b"PK\x05\x06")
      .last()
      .expect("end record");
    write_u32(bytes, end_record + 12, u32::MAX);
  }

  fn append_fake_end_record_to_comment(bytes: &mut Vec<u8>, fake_count: u16) {
    const END_RECORD_BYTES: usize = 22;

    let real_end_record = *signature_offsets(bytes, b"PK\x05\x06")
      .last()
      .expect("real end record");
    assert_eq!(real_end_record + END_RECORD_BYTES, bytes.len());
    write_u16(bytes, real_end_record + 20, END_RECORD_BYTES as u16);

    let mut fake_end_record = [0_u8; END_RECORD_BYTES];
    fake_end_record[..4].copy_from_slice(b"PK\x05\x06");
    write_u16(&mut fake_end_record, 8, fake_count);
    write_u16(&mut fake_end_record, 10, fake_count);
    bytes.extend_from_slice(&fake_end_record);
  }

  fn append_fake_end_record_as_trailing_garbage(bytes: &mut Vec<u8>, fake_count: u16) {
    const END_RECORD_BYTES: usize = 22;

    let mut fake_end_record = [0_u8; END_RECORD_BYTES];
    fake_end_record[..4].copy_from_slice(b"PK\x05\x06");
    write_u16(&mut fake_end_record, 8, fake_count);
    write_u16(&mut fake_end_record, 10, fake_count);
    bytes.extend_from_slice(&fake_end_record);
  }

  fn insert_central_zip64_extra_field(bytes: &mut Vec<u8>) {
    const ZIP64_EXTRA_BYTES: usize = 28;

    let central = *signature_offsets(bytes, b"PK\x01\x02")
      .last()
      .expect("outer central header");
    let end_record = *signature_offsets(bytes, b"PK\x05\x06")
      .last()
      .expect("outer end record");
    let name_bytes = read_u16(bytes, central + 28) as usize;
    let old_extra_bytes = read_u16(bytes, central + 30) as usize;
    let insert_at = central + 46 + name_bytes + old_extra_bytes;
    let mut zip64_extra = [0_u8; ZIP64_EXTRA_BYTES];
    write_u16(&mut zip64_extra, 0, 0x0001);
    write_u16(&mut zip64_extra, 2, 24);
    zip64_extra[12..20].copy_from_slice(&u64::MAX.to_le_bytes());
    bytes.splice(insert_at..insert_at, zip64_extra);

    write_u16(
      bytes,
      central + 30,
      (old_extra_bytes + ZIP64_EXTRA_BYTES) as u16,
    );
    let shifted_end_record = end_record + ZIP64_EXTRA_BYTES;
    let old_central_directory_bytes = read_u32(bytes, shifted_end_record + 12);
    write_u32(
      bytes,
      shifted_end_record + 12,
      old_central_directory_bytes + ZIP64_EXTRA_BYTES as u32,
    );
  }

  fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = !0_u32;
    for byte in bytes {
      crc ^= u32::from(*byte);
      for _ in 0..8 {
        let mask = 0_u32.wrapping_sub(crc & 1);
        crc = (crc >> 1) ^ (0xedb8_8320 & mask);
      }
    }
    !crc
  }

  fn make_nested_end_record_reach_outer_eof(bytes: &mut [u8], nested_bytes: usize) -> Vec<u8> {
    const END_RECORD_BYTES: usize = 22;

    let outer_local = signature_offsets(bytes, b"PK\x03\x04")[0];
    let outer_central = *signature_offsets(bytes, b"PK\x01\x02")
      .last()
      .expect("outer central header");
    let local_name_bytes = read_u16(bytes, outer_local + 26) as usize;
    let local_extra_bytes = read_u16(bytes, outer_local + 28) as usize;
    let data_start = outer_local + 30 + local_name_bytes + local_extra_bytes;
    let data_end = data_start + nested_bytes;
    let nested_end_record = signature_offsets(&bytes[data_start..data_end], b"PK\x05\x06")
      .last()
      .map(|offset| data_start + offset)
      .expect("nested end record");
    let forged_comment_bytes = bytes.len() - nested_end_record - END_RECORD_BYTES;
    assert!(forged_comment_bytes <= u16::MAX as usize);
    write_u16(bytes, nested_end_record + 20, forged_comment_bytes as u16);

    let nested_contents = bytes[data_start..data_end].to_vec();
    let nested_crc = crc32(&nested_contents);
    write_u32(bytes, outer_local + 14, nested_crc);
    write_u32(bytes, outer_central + 16, nested_crc);
    nested_contents
  }

  fn replace_entry_name(bytes: &mut [u8], entry_index: usize, replacement: &[u8]) {
    let local = signature_offsets(bytes, b"PK\x03\x04")[entry_index];
    let local_name_length = read_u16(bytes, local + 26) as usize;
    assert_eq!(local_name_length, replacement.len());
    bytes[local + 30..local + 30 + local_name_length].copy_from_slice(replacement);

    let central = signature_offsets(bytes, b"PK\x01\x02")[entry_index];
    let central_name_length = read_u16(bytes, central + 28) as usize;
    assert_eq!(central_name_length, replacement.len());
    bytes[central + 46..central + 46 + central_name_length].copy_from_slice(replacement);
  }

  fn mark_entry_encrypted(bytes: &mut [u8], entry_index: usize) {
    let local = signature_offsets(bytes, b"PK\x03\x04")[entry_index];
    write_u16(bytes, local + 6, read_u16(bytes, local + 6) | 1);
    let central = signature_offsets(bytes, b"PK\x01\x02")[entry_index];
    write_u16(bytes, central + 8, read_u16(bytes, central + 8) | 1);
  }

  fn set_entry_unix_mode(bytes: &mut [u8], entry_index: usize, mode: u32) {
    let central = signature_offsets(bytes, b"PK\x01\x02")[entry_index];
    bytes[central + 5] = 3;
    write_u32(bytes, central + 38, mode << 16);
  }

  fn corrupt_first_file_data(bytes: &mut [u8]) {
    let local = signature_offsets(bytes, b"PK\x03\x04")[0];
    let name_length = read_u16(bytes, local + 26) as usize;
    let extra_length = read_u16(bytes, local + 28) as usize;
    let data_offset = local + 30 + name_length + extra_length;
    bytes[data_offset] ^= 0xff;
  }

  fn make_entries_overlap(bytes: &mut [u8]) {
    let central = signature_offsets(bytes, b"PK\x01\x02");
    let first_local_offset = read_u32(bytes, central[0] + 42);
    write_u32(bytes, central[1] + 42, first_local_offset);
  }

  fn sync_extract(
    upload: Vec<u8>,
    limits: ExtractionLimits,
    temp_parent: &Path,
  ) -> Result<ExtractedZip, ZipExtractionError> {
    let progress = Arc::new(ExtractionProgress::new(upload.len()));
    extract_zip_sync(
      upload,
      limits,
      Instant::now() + Duration::from_secs(2),
      progress,
      Some(temp_parent),
    )
  }

  fn rejection(
    upload: Vec<u8>,
    limits: ExtractionLimits,
    expected: ZipRejectionKind,
  ) -> ZipExtractionError {
    let temp_parent = tempfile::tempdir().expect("create a test temp parent");
    let error = sync_extract(upload, limits, temp_parent.path())
      .expect_err("the malicious archive must be rejected");
    assert_eq!(error.kind, expected);
    assert!(!error.cleanup_failed);
    error
  }

  #[test]
  fn extracts_regular_files_and_cleans_the_guard_on_drop() {
    let nested_zip = make_many_files(MAX_ZIP_ENTRIES + 1);
    let upload = make_archive(&[
      TestEntry::Directory("assets/"),
      TestEntry::File("assets/index.lynx", b"bundle"),
      TestEntry::File("assets/nested.zip", &nested_zip),
    ]);
    let temp_parent = tempfile::tempdir().expect("create a test temp parent");
    let extracted = sync_extract(upload.clone(), PRODUCTION_LIMITS, temp_parent.path())
      .expect("extract a valid ZIP");
    let extracted_path = extracted.path().to_path_buf();

    assert_eq!(
      fs::read(extracted.path().join("assets/index.lynx")).expect("read extracted bundle"),
      b"bundle"
    );
    assert_eq!(
      fs::read(extracted.path().join("assets/nested.zip")).expect("read nested ZIP as a file"),
      nested_zip
    );
    assert!(!extracted.path().join("assets/inside.txt").exists());
    assert_eq!(extracted.stats().archive_bytes, upload.len() as u64);
    assert_eq!(extracted.stats().entry_count, 3);
    assert_eq!(
      extracted.stats().actual_uncompressed_bytes,
      (b"bundle".len() + nested_zip.len()) as u64
    );

    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;

      let mode = fs::metadata(extracted.path())
        .expect("stat the extraction root")
        .permissions()
        .mode()
        & 0o777;
      assert_eq!(mode, 0o700);
    }

    drop(extracted);
    assert!(!extracted_path.exists());
  }

  #[test]
  fn ignores_an_exact_eof_end_record_inside_nested_file_data() {
    let nested_zip = make_archive(&[TestEntry::File("inside.txt", b"nested")]);
    let mut upload = make_archive(&[TestEntry::File("nested.zip", &nested_zip)]);
    let expected_nested = make_nested_end_record_reach_outer_eof(&mut upload, nested_zip.len());
    let temp_parent = tempfile::tempdir().expect("create a test temp parent");
    let extracted = sync_extract(upload, PRODUCTION_LIMITS, temp_parent.path())
      .expect("treat the nested EOCD as ordinary file data");
    assert_eq!(
      fs::read(extracted.path().join("nested.zip")).expect("read the nested ZIP bytes"),
      expected_nested
    );
  }

  #[test]
  fn every_success_uses_a_fresh_directory() {
    let upload = make_archive(&[TestEntry::File("index.lynx", b"bundle")]);
    let temp_parent = tempfile::tempdir().expect("create a test temp parent");
    let first = sync_extract(upload.clone(), PRODUCTION_LIMITS, temp_parent.path())
      .expect("first extraction");
    let second =
      sync_extract(upload, PRODUCTION_LIMITS, temp_parent.path()).expect("second extraction");
    assert_ne!(first.path(), second.path());
  }

  #[tokio::test]
  async fn rejects_an_upload_over_ten_mebibytes_before_parsing() {
    let error = extract_uploaded_zip(vec![0; MAX_ZIP_UPLOAD_BYTES + 1])
      .await
      .expect_err("reject an oversized upload");
    assert_eq!(error.kind, ZipRejectionKind::UploadTooLarge);
    assert_eq!(error.stats.archive_bytes, (MAX_ZIP_UPLOAD_BYTES + 1) as u64);
    assert_eq!(error.stats.entry_count, 0);
  }

  #[tokio::test]
  async fn extraction_slots_wait_for_capacity_within_the_deadline() {
    // Use a private semaphore so this capacity test cannot race other ZIP
    // endpoint tests running in parallel on the process-wide pool.
    let permits = Arc::new(Semaphore::new(1));
    let occupied = Arc::clone(&permits)
      .acquire_owned()
      .await
      .expect("occupy the only extraction slot");
    let waiting_permits = Arc::clone(&permits);
    let waiting = tokio::spawn(async move {
      let progress = ExtractionProgress::new(0);
      acquire_extraction_slot(
        waiting_permits,
        Instant::now() + Duration::from_secs(1),
        &progress,
      )
      .await
    });

    tokio::task::yield_now().await;
    assert!(!waiting.is_finished());
    drop(occupied);
    let acquired = waiting
      .await
      .expect("join the waiting extraction")
      .expect("acquire the released slot");
    drop(acquired);
  }

  #[tokio::test]
  async fn extraction_slot_wait_respects_the_deadline() {
    let permits = Arc::new(Semaphore::new(0));
    let progress = ExtractionProgress::new(0);
    let error = acquire_extraction_slot(
      permits,
      Instant::now() + Duration::from_millis(1),
      &progress,
    )
    .await
    .expect_err("time out while every extraction slot is occupied");

    assert_eq!(error.kind, ZipRejectionKind::TimedOut);
    assert_eq!(error.stats.archive_bytes, 0);
    assert_eq!(error.stats.entry_count, 0);
  }

  #[test]
  fn parses_content_instead_of_trusting_a_file_extension() {
    rejection(
      b"this is named .zip by an untrusted caller".to_vec(),
      PRODUCTION_LIMITS,
      ZipRejectionKind::InvalidArchive,
    );
  }

  #[test]
  fn rejects_zip64_sentinels_before_library_parsing() {
    let mut upload = make_archive(&[TestEntry::File("safe.txt", b"safe")]);
    mark_classic_end_record_as_zip64(&mut upload);

    let error = rejection(upload, PRODUCTION_LIMITS, ZipRejectionKind::InvalidArchive);
    assert_eq!(error.stats.entry_count, 0);
  }

  #[test]
  fn rejects_zip64_extra_fields_without_classic_sentinels() {
    let mut upload = make_archive(&[TestEntry::File("safe.txt", b"safe")]);
    insert_central_zip64_extra_field(&mut upload);

    let error = rejection(upload, PRODUCTION_LIMITS, ZipRejectionKind::InvalidArchive);
    assert_eq!(error.stats.entry_count, 1);
  }

  #[test]
  fn rejects_ambiguous_end_records_before_library_fallback() {
    let mut upload = make_many_files(MAX_ZIP_ENTRIES + 1);
    append_fake_end_record_to_comment(&mut upload, 1);

    let error = rejection(upload, PRODUCTION_LIMITS, ZipRejectionKind::InvalidArchive);
    assert_eq!(error.stats.entry_count, 1);
  }

  #[test]
  fn rejects_a_fake_final_end_record_without_parsing_the_large_fallback() {
    let mut upload = make_many_files(MAX_ZIP_ENTRIES + 1);
    append_fake_end_record_as_trailing_garbage(&mut upload, 1);

    let error = rejection(upload, PRODUCTION_LIMITS, ZipRejectionKind::InvalidArchive);
    assert_eq!(error.stats.entry_count, 1);
  }

  #[test]
  fn accepts_one_hundred_entries_and_rejects_the_101st() {
    let temp_parent = tempfile::tempdir().expect("create a test temp parent");
    let accepted = sync_extract(
      make_many_files(MAX_ZIP_ENTRIES),
      PRODUCTION_LIMITS,
      temp_parent.path(),
    )
    .expect("accept exactly 100 entries");
    assert_eq!(accepted.stats().entry_count, MAX_ZIP_ENTRIES);

    let error = rejection(
      make_many_files(MAX_ZIP_ENTRIES + 1),
      PRODUCTION_LIMITS,
      ZipRejectionKind::TooManyEntries,
    );
    assert_eq!(error.stats.entry_count, MAX_ZIP_ENTRIES + 1);

    let mut underreported = make_many_files(MAX_ZIP_ENTRIES + 1);
    set_advertised_entry_count(&mut underreported, 1);
    let error = rejection(
      underreported,
      PRODUCTION_LIMITS,
      ZipRejectionKind::TooManyEntries,
    );
    assert_eq!(error.stats.entry_count, MAX_ZIP_ENTRIES + 1);
  }

  #[test]
  fn rejects_unsafe_or_ambiguous_paths_without_echoing_them() {
    for name in [
      "../../do-not-log-this",
      "/absolute.txt",
      "assets\\windows.txt",
      "assets/./alias.txt",
      "assets//alias.txt",
    ] {
      let error = rejection(
        make_archive(&[TestEntry::File(name, b"x")]),
        PRODUCTION_LIMITS,
        ZipRejectionKind::UnsafePath,
      );
      assert!(!error.to_string().contains(name));
    }
  }

  #[test]
  fn enforces_depth_component_and_relative_path_byte_limits() {
    let deep_path = format!("{}/file", vec!["dir"; MAX_PATH_DEPTH].join("/"));
    rejection(
      make_archive(&[TestEntry::File(&deep_path, b"x")]),
      PRODUCTION_LIMITS,
      ZipRejectionKind::PathTooDeep,
    );

    let long_component = "x".repeat(MAX_FILE_NAME_BYTES + 1);
    rejection(
      make_archive(&[TestEntry::File(&long_component, b"x")]),
      PRODUCTION_LIMITS,
      ZipRejectionKind::FileNameTooLong,
    );

    let mut components = vec!["x".repeat(240); 16];
    components.push("y".repeat(241));
    let long_path = components.join("/");
    assert_eq!(long_path.len(), MAX_RELATIVE_PATH_BYTES + 1);
    rejection(
      make_archive(&[TestEntry::File(&long_path, b"x")]),
      PRODUCTION_LIMITS,
      ZipRejectionKind::PathTooLong,
    );
  }

  #[test]
  fn rejects_duplicate_and_file_directory_conflicts_before_writing() {
    let mut duplicate = make_archive(&[
      TestEntry::File("a.txt", b"first"),
      TestEntry::File("b.txt", b"later"),
    ]);
    replace_entry_name(&mut duplicate, 1, b"a.txt");
    rejection(
      duplicate,
      PRODUCTION_LIMITS,
      ZipRejectionKind::DuplicatePath,
    );

    for entries in [
      vec![
        TestEntry::File("assets", b"file"),
        TestEntry::File("assets/page.lynx", b"nested"),
      ],
      vec![
        TestEntry::File("assets/page.lynx", b"nested"),
        TestEntry::File("assets", b"file"),
      ],
    ] {
      rejection(
        make_archive(&entries),
        PRODUCTION_LIMITS,
        ZipRejectionKind::ConflictingPath,
      );
    }
  }

  #[test]
  fn rejects_encrypted_entries() {
    let mut upload = make_archive(&[TestEntry::File("secret.txt", b"secret")]);
    mark_entry_encrypted(&mut upload, 0);
    rejection(upload, PRODUCTION_LIMITS, ZipRejectionKind::EncryptedEntry);
  }

  #[test]
  fn rejects_symlinks_and_unix_special_files() {
    for mode in [0o120_777, 0o010_644, 0o020_644, 0o060_644, 0o140_644] {
      let mut upload = make_archive(&[TestEntry::File("special", b"target")]);
      set_entry_unix_mode(&mut upload, 0, mode);
      rejection(
        upload,
        PRODUCTION_LIMITS,
        ZipRejectionKind::UnsupportedEntryType,
      );
    }
  }

  #[test]
  fn rejects_overlapping_compressed_ranges() {
    let mut upload = make_archive(&[
      TestEntry::File("first.txt", b"one"),
      TestEntry::File("other.txt", b"two"),
    ]);
    make_entries_overlap(&mut upload);
    rejection(
      upload,
      PRODUCTION_LIMITS,
      ZipRejectionKind::OverlappingEntries,
    );
  }

  #[test]
  fn propagates_crc_failure_and_cleans_the_partial_directory() {
    let mut upload = make_archive(&[TestEntry::File("page.lynx", b"bundle")]);
    corrupt_first_file_data(&mut upload);
    let temp_parent = tempfile::tempdir().expect("create a test temp parent");
    let error = sync_extract(upload, PRODUCTION_LIMITS, temp_parent.path())
      .expect_err("reject the corrupted entry");
    assert_eq!(error.kind, ZipRejectionKind::IntegrityCheckFailed);
    assert_eq!(
      fs::read_dir(temp_parent.path())
        .expect("list the test temp parent")
        .count(),
      0
    );
  }

  #[test]
  fn enforces_declared_file_total_and_compression_limits() {
    let upload = make_archive(&[TestEntry::File("large", b"123456")]);
    let mut file_limits = PRODUCTION_LIMITS;
    file_limits.max_single_file_bytes = 5;
    rejection(upload, file_limits, ZipRejectionKind::FileTooLarge);

    let upload = make_archive(&[
      TestEntry::File("one", b"1234"),
      TestEntry::File("two", b"5678"),
    ]);
    let mut total_limits = PRODUCTION_LIMITS;
    total_limits.max_single_file_bytes = 5;
    total_limits.max_total_uncompressed_bytes = 7;
    rejection(upload, total_limits, ZipRejectionKind::ArchiveTooLarge);

    let upload = make_archive_with_method(
      &[TestEntry::File("compressed", &[0; 4_096])],
      CompressionMethod::Deflated,
    );
    let mut ratio_limits = PRODUCTION_LIMITS;
    ratio_limits.max_compression_ratio = 2;
    rejection(
      upload,
      ratio_limits,
      ZipRejectionKind::CompressionRatioTooHigh,
    );
  }

  struct OneByteReader<R>(R);

  impl<R: Read> Read for OneByteReader<R> {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
      let length = buffer.len().min(1);
      self.0.read(&mut buffer[..length])
    }
  }

  #[test]
  fn stream_limits_actual_bytes_instead_of_trusting_declared_size() {
    let progress = ExtractionProgress::new(1_000);
    let mut reader = OneByteReader(Cursor::new(b"123456"));
    let mut output = Vec::new();
    let mut limits = PRODUCTION_LIMITS;
    limits.max_single_file_bytes = 4;
    let error = stream_entry(
      &mut reader,
      &mut output,
      100,
      1,
      100,
      limits,
      Instant::now() + Duration::from_secs(1),
      &progress,
    )
    .expect_err("reject actual bytes beyond the file limit");
    assert_eq!(error.kind, ZipRejectionKind::FileTooLarge);
    assert_eq!(error.stats.actual_uncompressed_bytes, 4);
    assert_eq!(output, b"1234");
  }

  #[test]
  fn stream_enforces_actual_file_and_archive_compression_ratios() {
    let progress = ExtractionProgress::new(100);
    let mut reader = OneByteReader(Cursor::new(b"1234"));
    let mut output = Vec::new();
    let mut limits = PRODUCTION_LIMITS;
    limits.max_compression_ratio = 2;
    let error = stream_entry(
      &mut reader,
      &mut output,
      1,
      4,
      10,
      limits,
      Instant::now() + Duration::from_secs(1),
      &progress,
    )
    .expect_err("reject the actual per-file compression ratio");
    assert_eq!(error.kind, ZipRejectionKind::CompressionRatioTooHigh);
    assert_eq!(error.stats.actual_uncompressed_bytes, 2);

    let progress = ExtractionProgress::new(1);
    let mut reader = OneByteReader(Cursor::new(b"123"));
    let mut output = Vec::new();
    let error = stream_entry(
      &mut reader,
      &mut output,
      10,
      3,
      10,
      limits,
      Instant::now() + Duration::from_secs(1),
      &progress,
    )
    .expect_err("reject the actual archive-to-upload ratio");
    assert_eq!(error.kind, ZipRejectionKind::CompressionRatioTooHigh);
    assert_eq!(error.stats.actual_uncompressed_bytes, 2);
  }

  #[test]
  fn stream_enforces_actual_total_size() {
    let progress = ExtractionProgress::new(100);
    progress
      .actual_uncompressed_bytes
      .store(4, Ordering::Relaxed);
    let mut reader = OneByteReader(Cursor::new(b"12"));
    let mut output = Vec::new();
    let mut limits = PRODUCTION_LIMITS;
    limits.max_total_uncompressed_bytes = 5;
    let error = stream_entry(
      &mut reader,
      &mut output,
      100,
      2,
      100,
      limits,
      Instant::now() + Duration::from_secs(1),
      &progress,
    )
    .expect_err("reject actual bytes beyond the archive limit");
    assert_eq!(error.kind, ZipRejectionKind::ArchiveTooLarge);
    assert_eq!(error.stats.actual_uncompressed_bytes, 5);
    assert_eq!(output, b"1");
  }

  #[test]
  fn expired_deadlines_are_rejected_and_staged_timeouts_are_cleaned() {
    let upload = make_archive(&[TestEntry::File("page.lynx", b"bundle")]);
    let progress = Arc::new(ExtractionProgress::new(upload.len()));
    let temp_parent = tempfile::tempdir().expect("create a test temp parent");
    let error = extract_zip_sync(
      upload,
      PRODUCTION_LIMITS,
      Instant::now(),
      Arc::clone(&progress),
      Some(temp_parent.path()),
    )
    .expect_err("reject an expired deadline");
    assert_eq!(error.kind, ZipRejectionKind::TimedOut);

    let staged = create_staging_directory(Some(temp_parent.path()), &progress)
      .expect("create a staged directory");
    let staged_path = staged.path().to_path_buf();
    let timed_out = progress.reject(ZipRejectionKind::TimedOut);
    let error = finish_staged_extraction(staged, Err(timed_out), &progress)
      .expect_err("propagate the timeout");
    assert_eq!(error.kind, ZipRejectionKind::TimedOut);
    assert!(!staged_path.exists());
  }

  #[test]
  fn production_concurrency_is_bounded_at_four() {
    assert_eq!(MAX_CONCURRENT_EXTRACTIONS, 4);
  }
}
