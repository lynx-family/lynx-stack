// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

//! Volcengine TOS storage for screenshot results.
//!
//! The server uploads each captured BMP to TOS and returns the object's public
//! URL instead of the image bytes. Configuration deliberately reuses the
//! environment variable names of GenUI Server's `app/common/tos-storage.ts`, so
//! one set of credentials configures both services. Uploads go through the
//! official `ve-tos-rust-sdk` crate, the Rust counterpart of the
//! `@volcengine/tos-sdk` package that GenUI Server uses. The SDK handles retries
//! and CRC64 verification; internal TOS V1 authentication is opt-in.

use std::collections::HashMap;
use std::fmt;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use thiserror::Error;
use uuid::Uuid;
use ve_tos_rust_sdk::asynchronous::object::ObjectAPI;
use ve_tos_rust_sdk::asynchronous::tos::{self, AsyncRuntime, TosClientImpl};
use ve_tos_rust_sdk::credential::{CommonCredentials, CommonCredentialsProvider};
use ve_tos_rust_sdk::error::TosError;
use ve_tos_rust_sdk::object::PutObjectFromBufferInput;

const DEFAULT_SCREENSHOT_PREFIX: &str = "screenshot";
const SCREENSHOT_FILE: &str = "screenshot.bmp";
const PARAMETERS_FILE: &str = "screenshot.json";
const PARAMETERS_CONTENT_TYPE: &str = "application/json";
const SCREENSHOT_CONTENT_TYPE: &str = "image/bmp";
// Matches GenUI Server's uploadTosObject cache policy.
const OBJECT_CACHE_CONTROL: &str = "public, max-age=1800";
const CONNECT_TIMEOUT_MS: isize = 10_000;
const REQUEST_TIMEOUT_MS: isize = 30_000;
// Retries cover transient TOS and network failures. Together with the request
// timeout they stay inside UPLOAD_DEADLINE, which is the hard bound.
const MAX_RETRIES: isize = 2;
const UPLOAD_DEADLINE: Duration = Duration::from_secs(100);
// One signature covers the entire bounded SDK retry sequence.
const SIGNATURE_LIFETIME_SECONDS: i64 = 600;
const MAX_ERROR_DETAIL_CHARS: usize = 512;

/// Environment variables that must all be set for screenshots to be stored.
const REQUIRED_VARIABLES: [&str; 4] = [
  "TOS_ACCESS_KEY",
  "TOS_SECRET_KEY",
  "TOS_BUCKET",
  "TOS_REGION",
];

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TosConfigError {
  #[error("missing required TOS environment variables: {}", .0.join(", "))]
  Missing(Vec<&'static str>),
  #[error("TOS_ENDPOINT must be an HTTP(S) endpoint host")]
  InvalidEndpoint,
  #[error("TOS_SCREENSHOT_STORAGE_PREFIX must not contain empty, \".\", or \"..\" path segments")]
  InvalidPrefix,
  #[error("TOS_OVERRIDE_REQUEST_HEADER must be true, false, 1, or 0")]
  InvalidOverrideRequestHeader,
  #[error("the TOS client could not be created: {0}")]
  Client(String),
}

#[derive(Debug, Error)]
pub(crate) enum TosUploadError {
  #[error("TOS request failed: {0}")]
  Client(String),
  #[error("TOS rejected the upload with HTTP {status}: {detail}")]
  Rejected { status: u16, detail: String },
}

/// Credentials and addressing for one TOS bucket.
#[derive(Clone)]
pub(crate) struct TosConfig {
  access_key: String,
  secret_key: String,
  security_token: Option<String>,
  override_request_header: bool,
  bucket: String,
  region: String,
  secure: bool,
  /// `host` or `host:port`, exactly as `URL.host` renders it in GenUI Server.
  endpoint_host: String,
  /// Slash-trimmed key prefix; empty stores objects at the bucket root.
  prefix: String,
}

impl fmt::Debug for TosConfig {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    f.debug_struct("TosConfig")
      .field("bucket", &self.bucket)
      .field("region", &self.region)
      .field("endpoint_host", &self.endpoint_host)
      .field("prefix", &self.prefix)
      .field("override_request_header", &self.override_request_header)
      .finish_non_exhaustive()
  }
}

impl TosConfig {
  /// Reads the configuration with the variable names, trimming, and endpoint
  /// rules of GenUI Server's `resolveTosStorageConfig`, except that missing
  /// credentials are an error instead of silently disabling storage.
  pub(crate) fn from_env() -> Result<Self, TosConfigError> {
    Self::from_lookup(|name| std::env::var(name).ok())
  }

  fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Result<Self, TosConfigError> {
    let read = |name: &str| {
      lookup(name)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    };
    let missing: Vec<&'static str> = REQUIRED_VARIABLES
      .into_iter()
      .filter(|name| read(name).is_none())
      .collect();
    if !missing.is_empty() {
      return Err(TosConfigError::Missing(missing));
    }
    let region = read("TOS_REGION").expect("checked above");
    let endpoint = read("TOS_ENDPOINT").unwrap_or_else(|| format!("tos-{region}.volces.com"));
    let (secure, endpoint_host) = parse_endpoint(&endpoint)?;
    let prefix = normalize_prefix(
      &read("TOS_SCREENSHOT_STORAGE_PREFIX").unwrap_or_else(|| DEFAULT_SCREENSHOT_PREFIX.into()),
    )?;
    let config = Self {
      access_key: read("TOS_ACCESS_KEY").expect("checked above"),
      secret_key: read("TOS_SECRET_KEY").expect("checked above"),
      security_token: read("TOS_SECURITY_TOKEN"),
      override_request_header: match read("TOS_OVERRIDE_REQUEST_HEADER")
        .as_deref()
        .map(str::to_ascii_lowercase)
        .as_deref()
      {
        None | Some("false" | "0") => false,
        Some("true" | "1") => true,
        _ => return Err(TosConfigError::InvalidOverrideRequestHeader),
      },
      bucket: read("TOS_BUCKET").expect("checked above"),
      region,
      secure,
      endpoint_host,
      prefix,
    };
    // Reject bucket names or endpoints that cannot form a request URL now,
    // instead of failing every upload later.
    reqwest::Url::parse(&config.object_url("/probe"))
      .map_err(|_| TosConfigError::InvalidEndpoint)?;
    Ok(config)
  }

  fn scheme(&self) -> &'static str {
    if self.secure {
      "https"
    } else {
      "http"
    }
  }

  fn object_key(&self, id: &Uuid, filename: &str) -> String {
    if self.prefix.is_empty() {
      format!("{id}/{filename}")
    } else {
      format!("{}/{id}/{filename}", self.prefix)
    }
  }

  /// Unsigned public object URL with a virtual-hosted-style bucket host. Reads
  /// are governed by the bucket policy.
  fn object_url(&self, path: &str) -> String {
    format!(
      "{}://{}.{}{path}",
      self.scheme(),
      self.bucket,
      self.endpoint_host
    )
  }

  /// Internal TOS V1 signature for a plain object PUT with no query parameters
  /// or signed headers. Sign the raw object key, before URL percent-encoding.
  fn put_request_headers(&self, key: &str, now: DateTime<Utc>) -> HashMap<String, String> {
    let expiration = now.timestamp() + SIGNATURE_LIFETIME_SECONDS;
    let canonical = format!("PUT\n/{}/{key}\n\n{expiration}", self.bucket);
    let mut mac = Hmac::<Sha256>::new_from_slice(self.secret_key.as_bytes())
      .expect("HMAC accepts any key length");
    mac.update(canonical.as_bytes());
    let signature = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    let credentials = format!(
      "{}/{}/{}/tos/sig_request",
      self.access_key,
      now.format("%Y%m%d"),
      self.region,
    );
    let mut headers = HashMap::from([(
      "X-Tos-Signature".into(),
      format!(
        "TOS-HMAC-SHA256 expiration={expiration},signame=,signature={},credentials={credentials}",
        &signature[..30],
      ),
    )]);
    if let Some(token) = &self.security_token {
      headers.insert("x-tos-security-token".into(), token.clone());
    }
    headers
  }
}

/// Mirrors `parseTosEndpoint`: a bare host means HTTPS, and only a plain
/// `scheme://host[:port]` origin is accepted.
fn parse_endpoint(endpoint: &str) -> Result<(bool, String), TosConfigError> {
  let has_scheme = endpoint.split_once("://").is_some_and(|(scheme, _)| {
    scheme.starts_with(|c: char| c.is_ascii_alphabetic())
      && scheme
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '.' | '-'))
  });
  let url = reqwest::Url::parse(&if has_scheme {
    endpoint.to_string()
  } else {
    format!("https://{endpoint}")
  })
  .map_err(|_| TosConfigError::InvalidEndpoint)?;
  if !matches!(url.scheme(), "http" | "https")
    || !url.username().is_empty()
    || url.password().is_some()
    || url.path() != "/"
    || url.query().is_some()
    || url.fragment().is_some()
  {
    return Err(TosConfigError::InvalidEndpoint);
  }
  let host = url.host_str().ok_or(TosConfigError::InvalidEndpoint)?;
  let endpoint_host = match url.port() {
    Some(port) => format!("{host}:{port}"),
    None => host.to_string(),
  };
  Ok((url.scheme() == "https", endpoint_host))
}

/// Trims surrounding slashes like `trimSlashes`, then rejects segments that
/// URL normalization would rewrite, which would make the public URL name a
/// different object than the one that was uploaded.
fn normalize_prefix(prefix: &str) -> Result<String, TosConfigError> {
  let prefix = prefix.trim_matches('/');
  if prefix.is_empty() {
    return Ok(String::new());
  }
  if prefix
    .split('/')
    .any(|segment| matches!(segment, "" | "." | ".."))
  {
    return Err(TosConfigError::InvalidPrefix);
  }
  Ok(prefix.to_string())
}

/// Percent-encodes every key segment with only RFC 3986 unreserved characters
/// left literal, for the public URL.
fn object_path(key: &str) -> String {
  let mut path = String::with_capacity(key.len() + 1);
  for segment in key.split('/') {
    path.push('/');
    for byte in segment.bytes() {
      if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~') {
        path.push(byte as char);
      } else {
        path.push_str(&format!("%{byte:02X}"));
      }
    }
  }
  path
}

/// Adapts the SDK's executor hooks to the Tokio runtime the server already runs.
#[derive(Debug, Default)]
struct TokioRuntime;

#[async_trait]
impl AsyncRuntime for TokioRuntime {
  type JoinError = tokio::task::JoinError;

  async fn sleep(&self, duration: Duration) {
    tokio::time::sleep(duration).await;
  }

  fn spawn<'a, F>(
    &self,
    future: F,
  ) -> Pin<Box<dyn Future<Output = Result<F::Output, Self::JoinError>> + Send + 'a>>
  where
    F: Future + Send + 'static,
    F::Output: Send + 'static,
  {
    Box::pin(tokio::runtime::Handle::current().spawn(future))
  }

  fn block_on<F: Future>(&self, future: F) -> F::Output {
    tokio::runtime::Handle::current().block_on(future)
  }
}

type Client =
  TosClientImpl<CommonCredentialsProvider<CommonCredentials>, CommonCredentials, TokioRuntime>;

struct TosUploader {
  client: Client,
  config: TosConfig,
}

impl TosUploader {
  fn new(config: TosConfig) -> Result<Self, TosConfigError> {
    Self::build(config, false)
  }

  /// `custom_domain` addresses the endpoint host itself instead of
  /// `<bucket>.<endpoint>`. Only tests set it, to reach a local stand-in
  /// without DNS.
  fn build(config: TosConfig, custom_domain: bool) -> Result<Self, TosConfigError> {
    let endpoint = format!("{}://{}", config.scheme(), config.endpoint_host);
    let mut builder = tos::builder::<TokioRuntime>()
      .region(config.region.clone())
      .endpoint(endpoint.clone())
      // Only object uploads are used, but the SDK insists that the control
      // endpoint share the endpoint's port and otherwise defaults it to a port
      // of its own, which would reject any `TOS_ENDPOINT` with an explicit port.
      .control_endpoint(endpoint)
      .connection_timeout(CONNECT_TIMEOUT_MS)
      .request_timeout(REQUEST_TIMEOUT_MS)
      .max_retry_count(MAX_RETRIES)
      // A redirect would resend the request to a host the caller never named.
      .follow_redirect_times(0)
      .is_custom_domain(custom_domain);
    // In override mode authentication comes exclusively from the per-upload
    // V1 header. Supplying SDK credentials would also add a V4 Authorization.
    if !config.override_request_header {
      builder = builder
        .ak(config.access_key.clone())
        .sk(config.secret_key.clone());
      if let Some(token) = &config.security_token {
        builder = builder.security_token(token.clone());
      }
    }
    let client = builder
      .build()
      .map_err(|error| TosConfigError::Client(error.to_string()))?;
    Ok(Self { client, config })
  }

  async fn put_bmp(&self, bmp: Vec<u8>, parameters: Vec<u8>) -> Result<String, TosUploadError> {
    let config = &self.config;
    let id = Uuid::new_v4();
    let key = config.object_key(&id, SCREENSHOT_FILE);
    let parameters_key = config.object_key(&id, PARAMETERS_FILE);
    tokio::time::timeout(UPLOAD_DEADLINE, async {
      self
        .put_object(&parameters_key, &parameters, PARAMETERS_CONTENT_TYPE)
        .await?;
      self.put_object(&key, &bmp, SCREENSHOT_CONTENT_TYPE).await
    })
    .await
    .map_err(|_| TosUploadError::Client("the upload timed out".into()))??;
    Ok(config.object_url(&object_path(&key)))
  }

  async fn put_object(
    &self,
    key: &str,
    bytes: &[u8],
    content_type: &str,
  ) -> Result<(), TosUploadError> {
    let mut input =
      PutObjectFromBufferInput::new_with_content(self.config.bucket.as_str(), key, bytes);
    input.set_content_type(content_type);
    input.set_cache_control(OBJECT_CACHE_CONTROL);
    if self.config.override_request_header {
      input.set_request_header(self.config.put_request_headers(key, Utc::now()));
    }
    self
      .client
      .put_object_from_buffer(&input)
      .await
      .map_err(upload_error)?;
    Ok(())
  }
}

fn upload_error(error: TosError) -> TosUploadError {
  match error.as_server_error() {
    Some(server) => TosUploadError::Rejected {
      status: u16::try_from(server.status_code()).unwrap_or(0),
      detail: bounded(format!(
        "{} (ec={}, request_id={})",
        server.message(),
        server.ec(),
        server.request_id(),
      )),
    },
    None => TosUploadError::Client(bounded(error.to_string())),
  }
}

fn bounded(text: String) -> String {
  text.chars().take(MAX_ERROR_DETAIL_CHARS).collect()
}

/// Where finished screenshots go. Production always uses TOS; unit tests swap
/// in an in-memory store so route behavior needs no network.
#[derive(Clone)]
pub(crate) struct ScreenshotStore {
  backend: Arc<Backend>,
}

enum Backend {
  Tos(TosUploader),
  #[cfg(test)]
  Memory(memory::MemoryStore),
}

impl ScreenshotStore {
  pub(crate) fn from_env() -> Result<Self, TosConfigError> {
    Self::from_config(TosConfig::from_env()?)
  }

  fn from_config(config: TosConfig) -> Result<Self, TosConfigError> {
    Ok(Self {
      backend: Arc::new(Backend::Tos(TosUploader::new(config)?)),
    })
  }

  /// Stores the input JSON and BMP together and returns the BMP public URL.
  pub(crate) async fn put_bmp(
    &self,
    bmp: Vec<u8>,
    parameters: Vec<u8>,
  ) -> Result<String, TosUploadError> {
    match self.backend.as_ref() {
      Backend::Tos(uploader) => uploader.put_bmp(bmp, parameters).await,
      #[cfg(test)]
      Backend::Memory(store) => store.put_bmp(bmp, parameters),
    }
  }
}

#[cfg(test)]
mod memory {
  use std::sync::{Arc, Mutex};

  use super::{Backend, ScreenshotStore, TosConfig, TosUploadError};

  pub(super) struct MemoryStore {
    config: TosConfig,
    fail_with_status: Option<u16>,
    objects: Mutex<Vec<(String, Vec<u8>)>>,
  }

  impl MemoryStore {
    pub(super) fn put_bmp(
      &self,
      bmp: Vec<u8>,
      parameters: Vec<u8>,
    ) -> Result<String, TosUploadError> {
      if let Some(status) = self.fail_with_status {
        return Err(TosUploadError::Rejected {
          status,
          detail: "simulated TOS failure".into(),
        });
      }
      let mut objects = self.objects.lock().unwrap();
      let id = uuid::Uuid::from_u128(objects.len() as u128 + 1);
      let path = super::object_path(&self.config.object_key(&id, super::SCREENSHOT_FILE));
      let url = self.config.object_url(&path);
      objects.push((url.clone(), bmp));
      let parameters_path =
        super::object_path(&self.config.object_key(&id, super::PARAMETERS_FILE));
      objects.push((self.config.object_url(&parameters_path), parameters));
      Ok(url)
    }
  }

  impl ScreenshotStore {
    pub(crate) fn in_memory() -> Self {
      Self::memory(None)
    }

    pub(crate) fn failing_with_status(status: u16) -> Self {
      Self::memory(Some(status))
    }

    fn memory(fail_with_status: Option<u16>) -> Self {
      let config = TosConfig::from_lookup(|name| {
        match name {
          "TOS_ACCESS_KEY" => Some("test-access-key"),
          "TOS_SECRET_KEY" => Some("test-secret-key"),
          "TOS_BUCKET" => Some("screenshots"),
          "TOS_REGION" => Some("cn-beijing"),
          _ => None,
        }
        .map(str::to_string)
      })
      .expect("test TOS configuration is valid");
      Self {
        backend: Arc::new(Backend::Memory(MemoryStore {
          config,
          fail_with_status,
          objects: Mutex::new(Vec::new()),
        })),
      }
    }

    /// Every stored `(url, bytes)` pair, oldest capture first.
    pub(crate) fn stored_objects(&self) -> Vec<(String, Vec<u8>)> {
      match self.backend.as_ref() {
        Backend::Memory(store) => store.objects.lock().unwrap().clone(),
        Backend::Tos(_) => panic!("not an in-memory screenshot store"),
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use std::collections::HashMap;
  use std::net::SocketAddr;
  use std::sync::Mutex;

  use axum::extract::{Request, State};
  use axum::http::StatusCode;
  use axum::response::{IntoResponse, Response};
  use axum::routing::any;
  use axum::Router;

  use super::*;

  fn config(variables: &[(&str, &str)]) -> Result<TosConfig, TosConfigError> {
    let variables: HashMap<_, _> = variables.iter().copied().collect();
    TosConfig::from_lookup(|name| variables.get(name).map(|value| value.to_string()))
  }

  const BASE: [(&str, &str); 4] = [
    ("TOS_ACCESS_KEY", "AKTESTACCESSKEY"),
    ("TOS_SECRET_KEY", "SKTESTSECRETKEY"),
    ("TOS_BUCKET", "genui"),
    ("TOS_REGION", "cn-beijing"),
  ];

  fn with<'a>(extra: &[(&'a str, &'a str)]) -> Vec<(&'a str, &'a str)> {
    BASE.iter().chain(extra).copied().collect()
  }

  #[test]
  fn config_lists_every_missing_required_variable() {
    assert_eq!(
      config(&[("TOS_BUCKET", "genui"), ("TOS_SECRET_KEY", "  ")]).unwrap_err(),
      TosConfigError::Missing(vec!["TOS_ACCESS_KEY", "TOS_SECRET_KEY", "TOS_REGION"]),
    );
    assert_eq!(
      config(&[]).unwrap_err().to_string(),
      "missing required TOS environment variables: TOS_ACCESS_KEY, TOS_SECRET_KEY, TOS_BUCKET, TOS_REGION",
    );
  }

  #[test]
  fn config_defaults_match_genui_server() {
    let config = config(&BASE).unwrap();
    assert!(config.secure);
    assert_eq!(config.endpoint_host, "tos-cn-beijing.volces.com");
    assert_eq!(
      config.object_url("/x"),
      "https://genui.tos-cn-beijing.volces.com/x"
    );
    assert_eq!(config.prefix, "screenshot");
    assert_eq!(config.security_token, None);
    assert!(!config.override_request_header);
  }

  #[test]
  fn config_validates_the_request_header_override() {
    for value in ["true", "1", " TRUE "] {
      assert!(
        config(&with(&[("TOS_OVERRIDE_REQUEST_HEADER", value)]))
          .unwrap()
          .override_request_header
      );
    }
    for value in ["false", "0", " FALSE ", "", " "] {
      assert!(
        !config(&with(&[("TOS_OVERRIDE_REQUEST_HEADER", value)]))
          .unwrap()
          .override_request_header
      );
    }
    for value in ["yes", "2", "treu"] {
      assert_eq!(
        config(&with(&[("TOS_OVERRIDE_REQUEST_HEADER", value)])).unwrap_err(),
        TosConfigError::InvalidOverrideRequestHeader
      );
    }
  }

  #[test]
  fn v1_signature_matches_fixed_vectors_for_raw_object_keys() {
    let config = config(&BASE).unwrap();
    let now = DateTime::from_timestamp(1_735_689_600, 0).unwrap();
    // Expected digests were calculated independently with Python hmac/hashlib.
    for (key, signature) in [
      (
        "shots/example/screenshot.bmp",
        "B3pDV8wIcEYZHvKo6Vm_hAPaLADI0b",
      ),
      ("a b/ü/(x)!*'~_.bmp", "5Ynec0Nkhd_T9MHYRjZ7sDhoJ4il0B"),
    ] {
      let headers = config.put_request_headers(key, now);
      assert_eq!(headers.len(), 1);
      assert_eq!(headers["X-Tos-Signature"], format!("TOS-HMAC-SHA256 expiration=1735690200,signame=,signature={signature},credentials=AKTESTACCESSKEY/20250101/cn-beijing/tos/sig_request"));
      assert_ne!(
        headers,
        config.put_request_headers(key, now + chrono::Duration::seconds(1))
      );
    }
  }

  #[test]
  fn config_reads_overrides_and_trims_values() {
    let config = config(&with(&[
      ("TOS_ENDPOINT", " http://tos.internal:8080 "),
      ("TOS_SECURITY_TOKEN", " sts "),
      ("TOS_SCREENSHOT_STORAGE_PREFIX", "/ui-judge/shots/"),
    ]))
    .unwrap();
    assert!(!config.secure);
    assert_eq!(config.endpoint_host, "tos.internal:8080");
    assert_eq!(config.security_token.as_deref(), Some("sts"));
    assert_eq!(config.prefix, "ui-judge/shots");
    assert_eq!(
      config.object_url("/ui-judge/shots/x/screenshot.bmp"),
      "http://genui.tos.internal:8080/ui-judge/shots/x/screenshot.bmp",
    );
  }

  #[test]
  fn config_accepts_bare_hosts_and_an_empty_prefix() {
    let config = config(&with(&[
      ("TOS_ENDPOINT", "tos-cn-shanghai.volces.com"),
      ("TOS_SCREENSHOT_STORAGE_PREFIX", "//"),
    ]))
    .unwrap();
    assert!(config.secure);
    assert_eq!(config.endpoint_host, "tos-cn-shanghai.volces.com");
    assert_eq!(
      config.object_key(&Uuid::from_u128(1), SCREENSHOT_FILE),
      "00000000-0000-0000-0000-000000000001/screenshot.bmp",
    );
  }

  #[test]
  fn config_rejects_endpoints_that_are_not_a_plain_origin() {
    for endpoint in [
      "ftp://tos.example.com",
      "https://user:pass@tos.example.com",
      "https://tos.example.com/bucket",
      "https://tos.example.com/?a=1",
      "https://tos.example.com/#frag",
      "https://",
      "bad host",
    ] {
      assert_eq!(
        config(&with(&[("TOS_ENDPOINT", endpoint)])).unwrap_err(),
        TosConfigError::InvalidEndpoint,
        "{endpoint}",
      );
    }
  }

  #[test]
  fn config_rejects_prefixes_that_url_normalization_would_rewrite() {
    for prefix in ["a/../b", "a//b", "./a", "a/."] {
      assert_eq!(
        config(&with(&[("TOS_SCREENSHOT_STORAGE_PREFIX", prefix)])).unwrap_err(),
        TosConfigError::InvalidPrefix,
        "{prefix}",
      );
    }
  }

  #[test]
  fn config_debug_never_prints_credentials() {
    let rendered = format!(
      "{:?}",
      config(&with(&[("TOS_SECURITY_TOKEN", "TOKEN-VALUE")])).unwrap()
    );
    for secret in ["AKTESTACCESSKEY", "SKTESTSECRETKEY", "TOKEN-VALUE"] {
      assert!(!rendered.contains(secret), "{rendered}");
    }
  }

  #[test]
  fn object_paths_encode_only_unreserved_characters() {
    assert_eq!(
      object_path("shots/0123-abcd/screenshot.bmp"),
      "/shots/0123-abcd/screenshot.bmp",
    );
    assert_eq!(
      object_path("a b/ü/(x)!*'~_.bmp"),
      "/a%20b/%C3%BC/%28x%29%21%2A%27~_.bmp",
    );
  }

  #[test]
  fn the_sdk_rejects_s3_endpoints_at_startup() {
    // TOS exposes an S3-compatible host with different signing rules; fail fast
    // instead of producing uploads TOS refuses.
    let config = config(&with(&[("TOS_ENDPOINT", "tos-s3-cn-beijing.volces.com")])).unwrap();
    match TosUploader::new(config) {
      Err(TosConfigError::Client(message)) => assert!(message.contains("S3"), "{message}"),
      other => panic!("unexpected result: {:?}", other.map(|_| ())),
    }
  }

  struct Received {
    body: Vec<u8>,
    headers: axum::http::HeaderMap,
    method: String,
    path: String,
  }

  type Log = Arc<Mutex<Vec<Received>>>;

  /// A one-route stand-in for TOS that records requests and answers `status`.
  /// Like TOS, it echoes the CRC64 of a stored object, which the SDK verifies.
  async fn fake_tos(status: StatusCode, reply: String) -> (SocketAddr, Log) {
    fake_tos_for_file(status, reply, None).await
  }

  async fn fake_tos_for_file(
    status: StatusCode,
    reply: String,
    filename: Option<&'static str>,
  ) -> (SocketAddr, Log) {
    async fn record(
      State((log, status, reply, filename)): State<(Log, StatusCode, String, Option<&'static str>)>,
      request: Request,
    ) -> Response {
      let (parts, body) = request.into_parts();
      let status = if filename.is_none_or(|filename| parts.uri.path().ends_with(filename)) {
        status
      } else {
        StatusCode::OK
      };
      let body = axum::body::to_bytes(body, usize::MAX)
        .await
        .unwrap()
        .to_vec();
      let mut crc = crc64fast::Digest::new();
      crc.write(&body);
      let crc = crc.sum64().to_string();
      log.lock().unwrap().push(Received {
        body,
        headers: parts.headers,
        method: parts.method.to_string(),
        path: parts.uri.path().to_string(),
      });
      let mut response = (status, reply).into_response();
      if status.is_success() {
        response
          .headers_mut()
          .insert("x-tos-hash-crc64ecma", crc.parse().unwrap());
      }
      response
    }
    let log = Log::default();
    let app =
      Router::new()
        .fallback(any(record))
        .with_state((Arc::clone(&log), status, reply, filename));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (address, log)
  }

  /// Points the SDK straight at the stand-in, bypassing `<bucket>.<endpoint>`
  /// DNS, while the config still describes the public bucket URL.
  fn uploader_for(address: SocketAddr, extra: &[(&str, &str)]) -> TosUploader {
    let endpoint = format!("http://localhost:{}", address.port());
    let mut variables = with(extra);
    variables.push(("TOS_ENDPOINT", endpoint.as_str()));
    TosUploader::build(config(&variables).unwrap(), true).unwrap()
  }

  fn tos_error_body(code: &str, message: &str) -> String {
    format!(
      r#"{{"Code":"{code}","Message":"{message}","RequestId":"req-1","HostId":"h","EC":"0001-00000001"}}"#
    )
  }

  #[tokio::test]
  async fn upload_puts_the_bmp_and_returns_the_public_url() {
    let (address, log) = fake_tos(StatusCode::OK, String::new()).await;
    let uploader = uploader_for(address, &[("TOS_SECURITY_TOKEN", "STS-TOKEN-VALUE")]);

    let url = uploader
      .put_bmp(
        b"BM-pixels".to_vec(),
        br#"{"entry":"index.lynxml"}"#.to_vec(),
      )
      .await
      .unwrap();

    let received = log.lock().unwrap();
    assert_eq!(received.len(), 2);
    let parameters = &received[0];
    let request = &received[1];
    assert_eq!(parameters.method, "PUT");
    assert_eq!(
      parameters.path,
      request.path.replace("screenshot.bmp", "screenshot.json")
    );
    assert_eq!(parameters.body, br#"{"entry":"index.lynxml"}"#);
    assert_eq!(parameters.headers["content-type"], "application/json");
    assert_eq!(parameters.headers["cache-control"], OBJECT_CACHE_CONTROL);
    assert!(!parameters.headers.contains_key("x-tos-acl"));
    assert_eq!(request.method, "PUT");
    assert_eq!(request.body, b"BM-pixels");
    assert!(
      request.path.starts_with("/screenshot/") && request.path.ends_with("/screenshot.bmp"),
      "{}",
      request.path,
    );
    assert_eq!(
      url,
      format!("http://genui.localhost:{}{}", address.port(), request.path)
    );
    let header = |name: &str| request.headers[name].to_str().unwrap().to_string();
    assert_eq!(header("content-type"), "image/bmp");
    assert_eq!(header("cache-control"), "public, max-age=1800");
    assert_eq!(header("x-tos-security-token"), "STS-TOKEN-VALUE");
    assert!(
      header("authorization").starts_with("TOS4-HMAC-SHA256 Credential=AKTESTACCESSKEY/")
        && header("authorization").contains("/cn-beijing/tos/request"),
      "{}",
      header("authorization"),
    );
    assert!(!request.headers.contains_key("x-tos-acl"));
    assert!(!request.headers.contains_key("x-tos-signature"));
    assert!(!header("authorization").contains("SKTESTSECRETKEY"));
  }

  #[tokio::test]
  async fn override_upload_uses_only_v1_authentication_and_preserves_object_headers() {
    let (address, log) = fake_tos(StatusCode::OK, String::new()).await;
    let uploader = uploader_for(
      address,
      &[
        ("TOS_OVERRIDE_REQUEST_HEADER", "true"),
        ("TOS_SECURITY_TOKEN", "STS-TOKEN-VALUE"),
        ("TOS_SCREENSHOT_STORAGE_PREFIX", "shots with spaces/ü"),
      ],
    );
    let before = Utc::now().timestamp();
    let url = uploader
      .put_bmp(b"BM-pixels".to_vec(), b"{}".to_vec())
      .await
      .unwrap();
    let after = Utc::now().timestamp();
    let received = log.lock().unwrap();
    assert_eq!(received.len(), 2);
    assert_eq!(received[0].body, b"{}");
    assert_eq!(received[0].headers["content-type"], "application/json");
    assert_eq!(received[1].body, b"BM-pixels");
    assert_eq!(received[1].headers["content-type"], "image/bmp");
    assert_eq!(
      received[0].path,
      received[1]
        .path
        .replace("screenshot.bmp", "screenshot.json")
    );
    assert_eq!(
      url,
      format!(
        "http://genui.localhost:{}{}",
        address.port(),
        received[1].path
      )
    );
    assert_ne!(
      received[0].headers["x-tos-signature"],
      received[1].headers["x-tos-signature"]
    );
    for request in received.iter() {
      assert_eq!(request.method, "PUT");
      assert_eq!(request.headers["cache-control"], OBJECT_CACHE_CONTROL);
      assert_eq!(request.headers["x-tos-security-token"], "STS-TOKEN-VALUE");
      assert!(!request.headers.contains_key("authorization"));
      assert!(!request.headers.contains_key("x-tos-acl"));
      let encoded_prefix = "/shots%20with%20spaces/%C3%BC/";
      let suffix = request.path.strip_prefix(encoded_prefix).unwrap();
      let key = format!("shots with spaces/ü/{suffix}");
      let signature = request.headers["x-tos-signature"].to_str().unwrap();
      let expiration: i64 = signature
        .strip_prefix("TOS-HMAC-SHA256 expiration=")
        .unwrap()
        .split(',')
        .next()
        .unwrap()
        .parse()
        .unwrap();
      assert!(
        (before + SIGNATURE_LIFETIME_SECONDS..=after + SIGNATURE_LIFETIME_SECONDS)
          .contains(&expiration)
      );
      assert!(expiration > after + UPLOAD_DEADLINE.as_secs() as i64);
      let signed_at = DateTime::from_timestamp(expiration - SIGNATURE_LIFETIME_SECONDS, 0).unwrap();
      assert_eq!(
        signature,
        uploader.config.put_request_headers(&key, signed_at)["X-Tos-Signature"]
      );
    }
  }

  #[tokio::test]
  async fn every_upload_gets_a_distinct_object_key() {
    let (address, _) = fake_tos(StatusCode::OK, String::new()).await;
    let uploader = uploader_for(address, &[]);
    let first = uploader.put_bmp(vec![1], b"{}".to_vec()).await.unwrap();
    let second = uploader.put_bmp(vec![1], b"{}".to_vec()).await.unwrap();
    assert_ne!(first, second);
  }

  #[tokio::test]
  async fn either_object_upload_failure_fails_the_capture_upload() {
    for (filename, requests) in [(PARAMETERS_FILE, 1), (SCREENSHOT_FILE, 2)] {
      let (address, log) = fake_tos_for_file(
        StatusCode::FORBIDDEN,
        tos_error_body("AccessDenied", "denied"),
        Some(filename),
      )
      .await;
      let error = uploader_for(address, &[])
        .put_bmp(b"BM-pixels".to_vec(), b"{}".to_vec())
        .await
        .unwrap_err();
      assert!(matches!(
        error,
        TosUploadError::Rejected { status: 403, .. }
      ));
      let received = log.lock().unwrap();
      assert_eq!(received.len(), requests);
      assert!(received.last().unwrap().path.ends_with(filename));
    }
  }

  #[tokio::test]
  async fn upload_reports_tos_rejections_with_a_bounded_detail() {
    let message = "x".repeat(4 * MAX_ERROR_DETAIL_CHARS);
    let (address, log) = fake_tos(
      StatusCode::FORBIDDEN,
      tos_error_body("AccessDenied", &message),
    )
    .await;
    let error = uploader_for(address, &[])
      .put_bmp(vec![0], b"{}".to_vec())
      .await
      .unwrap_err();
    match error {
      TosUploadError::Rejected { status, detail } => {
        assert_eq!(status, 403);
        assert!(detail.starts_with("xxx"), "{detail}");
        assert_eq!(detail.chars().count(), MAX_ERROR_DETAIL_CHARS);
      }
      other => panic!("unexpected error: {other}"),
    }
    // A client error is not retried.
    assert_eq!(log.lock().unwrap().len(), 1);
  }

  #[tokio::test]
  async fn upload_does_not_follow_redirects() {
    let (address, log) = fake_tos(StatusCode::TEMPORARY_REDIRECT, String::new()).await;
    let error = uploader_for(address, &[])
      .put_bmp(vec![0], b"{}".to_vec())
      .await
      .unwrap_err();
    assert!(
      matches!(error, TosUploadError::Rejected { status: 307, .. }),
      "{error}"
    );
    assert_eq!(log.lock().unwrap().len(), 1);
  }

  #[tokio::test]
  async fn upload_retries_server_errors_a_bounded_number_of_times() {
    for override_header in ["false", "true"] {
      let (address, log) = fake_tos(
        StatusCode::SERVICE_UNAVAILABLE,
        tos_error_body("ServiceUnavailable", "busy"),
      )
      .await;
      let error = uploader_for(address, &[("TOS_OVERRIDE_REQUEST_HEADER", override_header)])
        .put_bmp(vec![0], b"{}".to_vec())
        .await
        .unwrap_err();
      assert!(
        matches!(error, TosUploadError::Rejected { status: 503, .. }),
        "{error}"
      );
      let received = log.lock().unwrap();
      assert_eq!(received.len(), 1 + MAX_RETRIES as usize);
      for request in received.iter() {
        assert_eq!(
          request.headers.contains_key("authorization"),
          override_header == "false"
        );
        assert_eq!(
          request.headers.contains_key("x-tos-signature"),
          override_header == "true"
        );
        assert!(!request.headers.contains_key("x-tos-security-token"));
        assert_eq!(
          request.headers.get("x-tos-signature"),
          received[0].headers.get("x-tos-signature")
        );
        assert_eq!(request.path, received[0].path);
        assert_eq!(request.body, b"{}");
      }
    }
  }

  #[tokio::test]
  async fn upload_reports_unreachable_endpoints_as_client_errors() {
    // A port that was just released, so nothing is listening on it.
    let closed = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let dead = closed.local_addr().unwrap();
    drop(closed);
    let error = uploader_for(dead, &[])
      .put_bmp(vec![0], b"{}".to_vec())
      .await
      .unwrap_err();
    assert!(matches!(error, TosUploadError::Client(_)), "{error}");
  }
}
