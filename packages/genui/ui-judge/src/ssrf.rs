// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::net::IpAddr;
use std::time::Duration;

use reqwest::header::CONTENT_LENGTH;
use thiserror::Error;

#[derive(Debug)]
pub(crate) struct HttpResource {
  pub bytes: Vec<u8>,
}

#[derive(Debug, Error)]
pub(crate) enum HttpFetchError {
  #[error("URL must be an absolute HTTP(S) URL.")]
  InvalidUrl,
  #[error("URL credentials are not allowed.")]
  Credentials,
  #[error("URL host could not be resolved.")]
  Resolution,
  #[error("The remote request timed out.")]
  TimedOut,
  #[error("The remote request failed.")]
  Request,
  #[error("The remote server returned HTTP {0}.")]
  Status(u16),
  #[error("The remote response exceeds the {0}-byte limit.")]
  TooLarge(usize),
}

pub(crate) async fn fetch_http_resource(
  input: &str,
  max_bytes: usize,
  timeout: Duration,
) -> Result<HttpResource, HttpFetchError> {
  let url = parse_http_url(input)?;
  match tokio::time::timeout(timeout, fetch_http_resource_inner(url, max_bytes, timeout)).await {
    Ok(result) => result,
    Err(_) => Err(HttpFetchError::TimedOut),
  }
}

fn parse_http_url(input: &str) -> Result<reqwest::Url, HttpFetchError> {
  let url = reqwest::Url::parse(input.trim()).map_err(|_| HttpFetchError::InvalidUrl)?;
  if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
    return Err(HttpFetchError::InvalidUrl);
  }
  if !url.username().is_empty() || url.password().is_some() {
    return Err(HttpFetchError::Credentials);
  }
  Ok(url)
}

async fn fetch_http_resource_inner(
  url: reqwest::Url,
  max_bytes: usize,
  timeout: Duration,
) -> Result<HttpResource, HttpFetchError> {
  let host = url.host_str().ok_or(HttpFetchError::InvalidUrl)?;
  let mut builder = reqwest::Client::builder()
    .no_proxy()
    .redirect(reqwest::redirect::Policy::none())
    .timeout(timeout);
  let literal_host = host
    .strip_prefix('[')
    .and_then(|host| host.strip_suffix(']'))
    .unwrap_or(host);
  if literal_host.parse::<IpAddr>().is_err() {
    let port = url
      .port_or_known_default()
      .ok_or(HttpFetchError::InvalidUrl)?;
    let addresses: Vec<_> = tokio::net::lookup_host((host, port))
      .await
      .map_err(|_| HttpFetchError::Resolution)?
      .collect();
    if addresses.is_empty() {
      return Err(HttpFetchError::Resolution);
    }
    builder = builder.resolve_to_addrs(host, &addresses);
  }
  let client = builder.build().map_err(|_| HttpFetchError::Request)?;
  let mut response = client.get(url).send().await.map_err(|error| {
    if error.is_timeout() {
      HttpFetchError::TimedOut
    } else {
      HttpFetchError::Request
    }
  })?;
  if !response.status().is_success() {
    return Err(HttpFetchError::Status(response.status().as_u16()));
  }
  if response
    .headers()
    .get(CONTENT_LENGTH)
    .and_then(|value| value.to_str().ok())
    .and_then(|value| value.parse::<usize>().ok())
    .is_some_and(|length| length > max_bytes)
  {
    return Err(HttpFetchError::TooLarge(max_bytes));
  }
  let mut bytes = Vec::new();
  while let Some(chunk) = response.chunk().await.map_err(|error| {
    if error.is_timeout() {
      HttpFetchError::TimedOut
    } else {
      HttpFetchError::Request
    }
  })? {
    if bytes.len().saturating_add(chunk.len()) > max_bytes {
      return Err(HttpFetchError::TooLarge(max_bytes));
    }
    bytes.extend_from_slice(&chunk);
  }
  Ok(HttpResource { bytes })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn accepts_only_absolute_http_urls_without_credentials() {
    assert!(parse_http_url("https://example.com/archive.zip").is_ok());
    assert!(parse_http_url("http://203.0.113.1/archive.zip").is_ok());
    assert!(matches!(
      parse_http_url("file:///tmp/archive.zip"),
      Err(HttpFetchError::InvalidUrl)
    ));
    assert!(matches!(
      parse_http_url("https://user:secret@example.com/archive.zip"),
      Err(HttpFetchError::Credentials)
    ));
  }
}
