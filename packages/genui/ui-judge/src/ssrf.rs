// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
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
  #[error("URL host resolves to a non-public network address.")]
  NonPublicAddress,
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
  match literal_host.parse::<IpAddr>() {
    Ok(address) => {
      if !is_public_ip(address) {
        return Err(HttpFetchError::NonPublicAddress);
      }
    }
    Err(_) => {
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
      if addresses.iter().any(|address| !is_public_ip(address.ip())) {
        return Err(HttpFetchError::NonPublicAddress);
      }
      builder = builder.resolve_to_addrs(host, &addresses);
    }
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

fn is_public_ip(address: IpAddr) -> bool {
  match address {
    IpAddr::V4(address) => is_public_ipv4(address),
    IpAddr::V6(address) => is_public_ipv6(address),
  }
}

fn is_public_ipv4(address: Ipv4Addr) -> bool {
  let [a, b, c, _] = address.octets();
  !(a == 0
    || a == 10
    || a == 127
    || a >= 224
    || (a == 100 && (64..=127).contains(&b))
    || (a == 169 && b == 254)
    || (a == 172 && (16..=31).contains(&b))
    || (a == 192 && b == 0 && c == 0)
    || (a == 192 && b == 0 && c == 2)
    || (a == 192 && b == 88 && c == 99)
    || (a == 192 && b == 168)
    || (a == 198 && matches!(b, 18 | 19))
    || (a == 198 && b == 51 && c == 100)
    || (a == 203 && b == 0 && c == 113))
}

fn is_public_ipv6(address: Ipv6Addr) -> bool {
  if let Some(address) = address.to_ipv4_mapped() {
    return is_public_ipv4(address);
  }
  let segments = address.segments();
  let is_global_unicast = segments[0] & 0xe000 == 0x2000;
  let is_special_2001 = segments[0] == 0x2001 && segments[1] <= 0x01ff;
  let is_documentation = segments[0] == 0x2001 && segments[1] == 0x0db8;
  let is_six_to_four = segments[0] == 0x2002;
  is_global_unicast && !is_special_2001 && !is_documentation && !is_six_to_four
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

  #[test]
  fn rejects_non_public_ipv4_addresses() {
    for address in [
      "0.0.0.0",
      "10.0.0.1",
      "100.64.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "192.0.2.1",
      "192.168.0.1",
      "198.18.0.1",
      "198.51.100.1",
      "203.0.113.1",
      "224.0.0.1",
      "255.255.255.255",
    ] {
      assert!(!is_public_ip(address.parse().unwrap()), "{address}");
    }
    assert!(is_public_ip("8.8.8.8".parse().unwrap()));
  }

  #[test]
  fn rejects_non_public_ipv6_addresses() {
    for address in [
      "::",
      "::1",
      "::ffff:127.0.0.1",
      "64:ff9b::1",
      "2001:db8::1",
      "2002:7f00:1::",
      "fc00::1",
      "fe80::1",
      "ff00::1",
    ] {
      assert!(!is_public_ip(address.parse().unwrap()), "{address}");
    }
    assert!(is_public_ip("2606:4700:4700::1111".parse().unwrap()));
  }

  #[tokio::test]
  async fn rejects_literal_private_hosts_before_connecting() {
    let error = fetch_http_resource("http://127.0.0.1/private", 1024, Duration::from_secs(1))
      .await
      .unwrap_err();
    assert!(matches!(error, HttpFetchError::NonPublicAddress));
  }
}
