use std::io::Cursor;
use std::sync::{Arc, OnceLock};

use rayon::{ThreadPool, ThreadPoolBuilder};
use tokio::sync::{oneshot, Semaphore};

use crate::{Error, Result};

const DEFAULT_MAX_ENCODER_THREADS: usize = 4;
const JOBS_PER_THREAD: usize = 2;

struct PngEncoderPool {
  workers: ThreadPool,
  permits: Arc<Semaphore>,
}

impl PngEncoderPool {
  fn new() -> std::result::Result<Self, String> {
    let thread_count = std::thread::available_parallelism()
      .map(usize::from)
      .unwrap_or(1)
      .clamp(1, DEFAULT_MAX_ENCODER_THREADS);
    let capacity = thread_count.saturating_mul(JOBS_PER_THREAD).max(1);
    let workers = ThreadPoolBuilder::new()
      .num_threads(thread_count)
      .thread_name(|index| format!("lynx-png-encoder-{index}"))
      .build()
      .map_err(|error| format!("failed to start PNG encoder workers: {error}"))?;

    Ok(Self {
      workers,
      permits: Arc::new(Semaphore::new(capacity)),
    })
  }

  async fn encode(&self, width: usize, height: usize, rgba: Arc<[u8]>) -> Result<Vec<u8>> {
    let permit = Arc::clone(&self.permits)
      .acquire_owned()
      .await
      .map_err(|_| Error::Protocol("PNG encoder pool is closed".into()))?;
    let (result, response) = oneshot::channel();
    self.workers.spawn(move || {
      // A cancelled async waiter must not release capacity while its CPU work
      // is still running on Rayon.
      let _permit = permit;
      let encoded = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        encode_png(width, height, &rgba).map_err(|error| error.to_string())
      }))
      .unwrap_or_else(|_| Err("PNG encoder worker panicked".into()));
      let _ = result.send(encoded);
    });
    response
      .await
      .map_err(|_| Error::Protocol("PNG encoder worker stopped before replying".into()))?
      .map_err(Error::Protocol)
  }
}

fn pool() -> Result<&'static PngEncoderPool> {
  static POOL: OnceLock<std::result::Result<PngEncoderPool, String>> = OnceLock::new();
  POOL
    .get_or_init(PngEncoderPool::new)
    .as_ref()
    .map_err(|message| Error::Protocol(message.clone()))
}

pub(crate) async fn encode_png_async(
  width: usize,
  height: usize,
  rgba: Arc<[u8]>,
) -> Result<Vec<u8>> {
  pool()?.encode(width, height, rgba).await
}

fn encode_png(width: usize, height: usize, rgba: &[u8]) -> Result<Vec<u8>> {
  let expected = width
    .checked_mul(height)
    .and_then(|pixels| pixels.checked_mul(4))
    .ok_or_else(|| Error::Protocol("frame is too large".into()))?;
  if rgba.len() < expected {
    return Err(Error::Protocol("frame buffer is too small".into()));
  }
  let mut output = Cursor::new(Vec::new());
  {
    let mut encoder = png::Encoder::new(&mut output, width as u32, height as u32);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header()?;
    writer.write_image_data(&rgba[..expected])?;
  }
  Ok(output.into_inner())
}

#[cfg(test)]
mod tests {
  use super::*;

  fn assert_send_sync<T: Send + Sync>() {}

  #[test]
  fn encoder_pool_is_send_and_sync() {
    assert_send_sync::<PngEncoderPool>();
  }

  #[tokio::test(flavor = "current_thread")]
  async fn encodes_rgba_on_the_worker_pool() {
    let rgba: Arc<[u8]> = Arc::from([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
    ]);
    let png = encode_png_async(2, 2, rgba).await.unwrap();
    assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
  }
}
