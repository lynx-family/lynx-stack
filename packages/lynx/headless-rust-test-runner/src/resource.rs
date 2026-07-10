use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use lynx::{FetchResponse, ResourceFetcher, ResourceRequest, ResourceType};
use url::Url;

use crate::{Error, Result};

#[derive(Clone)]
pub(crate) struct ResourceContext {
  base_url: Arc<Mutex<String>>,
  resources_path: Option<PathBuf>,
  lynx_core_path: PathBuf,
}

impl ResourceContext {
  pub(crate) fn new(resources_path: Option<PathBuf>, lynx_core_path: PathBuf) -> Self {
    Self {
      base_url: Arc::new(Mutex::new(String::new())),
      resources_path,
      lynx_core_path,
    }
  }

  pub(crate) fn set_base_url(&self, base_url: &str) {
    *self.base_url.lock().expect("base URL lock poisoned") = base_url.to_string();
  }

  pub(crate) fn fetcher(&self) -> HostResourceFetcher {
    HostResourceFetcher {
      context: self.clone(),
    }
  }

  pub(crate) async fn read_template(&self, input: &str) -> Result<(String, Vec<u8>)> {
    if input.starts_with("http://") || input.starts_with("https://") {
      return Ok((input.to_string(), fetch_http_async(input).await?));
    }
    if input.starts_with("file://") {
      let url = Url::parse(input)?;
      let path = url
        .to_file_path()
        .map_err(|_| Error::Protocol(format!("invalid file URL: {input}")))?;
      return Ok((input.to_string(), tokio::fs::read(path).await?));
    }
    if input.starts_with("assets://") {
      let path = self.resolve_assets_url(input)?;
      return Ok((input.to_string(), tokio::fs::read(path).await?));
    }

    let path = tokio::fs::canonicalize(input).await?;
    let url = Url::from_file_path(&path)
      .map_err(|_| Error::Protocol(format!("cannot convert path to file URL: {input}")))?;
    Ok((url.into(), tokio::fs::read(path).await?))
  }

  fn resolve_url(&self, input: &str) -> Result<ResolvedResource> {
    if input.starts_with("http://") || input.starts_with("https://") {
      return Ok(ResolvedResource::Http(input.to_string()));
    }
    if input.starts_with("file://") {
      let url = Url::parse(input)?;
      return url
        .to_file_path()
        .map(ResolvedResource::File)
        .map_err(|_| Error::Protocol(format!("invalid file URL: {input}")));
    }
    if input.starts_with("assets://") {
      return Ok(ResolvedResource::File(self.resolve_assets_url(input)?));
    }

    let base_url = self
      .base_url
      .lock()
      .expect("base URL lock poisoned")
      .clone();
    if !base_url.is_empty() {
      let resolved = Url::parse(&base_url)?.join(input)?;
      return self.resolve_url(resolved.as_str());
    }
    Ok(ResolvedResource::File(PathBuf::from(input)))
  }

  fn resolve_assets_url(&self, input: &str) -> Result<PathBuf> {
    let root = self.resources_path.as_ref().ok_or_else(|| {
      Error::Protocol(format!(
        "cannot resolve {input} without ConnectOptions::resources_path"
      ))
    })?;
    let relative = input
      .trim_start_matches("assets://")
      .trim_start_matches('/');
    safe_join(root, relative)
  }
}

pub(crate) struct HostResourceFetcher {
  context: ResourceContext,
}

impl ResourceFetcher for HostResourceFetcher {
  fn fetch(&mut self, request: ResourceRequest) -> FetchResponse {
    let result = if request.resource_type == ResourceType::LynxCoreJs
      || request.url.contains("lynx_core.js")
    {
      fs::read(&self.context.lynx_core_path).map_err(Error::from)
    } else {
      match self.context.resolve_url(&request.url) {
        Ok(ResolvedResource::Http(url)) => fetch_http(&url),
        Ok(ResolvedResource::File(path)) => fs::read(path).map_err(Error::from),
        Err(error) => Err(error),
      }
    };
    match result {
      Ok(bytes) => FetchResponse::ok(bytes),
      Err(error) => FetchResponse::error(-1, error.to_string()),
    }
  }

  fn fetch_path(&mut self, request: ResourceRequest) -> FetchResponse {
    self.fetch(request)
  }
}

enum ResolvedResource {
  Http(String),
  File(PathBuf),
}

fn fetch_http(url: &str) -> Result<Vec<u8>> {
  let response = ureq::get(url).call().map_err(|error| Error::Fetch {
    url: url.to_string(),
    message: error.to_string(),
  })?;
  let mut bytes = Vec::new();
  response
    .into_reader()
    .read_to_end(&mut bytes)
    .map_err(Error::from)?;
  Ok(bytes)
}

async fn fetch_http_async(url: &str) -> Result<Vec<u8>> {
  let url = url.to_string();
  tokio::task::spawn_blocking(move || fetch_http(&url))
    .await
    .map_err(|error| Error::Protocol(format!("HTTP fetch task failed: {error}")))?
}

fn safe_join(root: &Path, relative: &str) -> Result<PathBuf> {
  let path = root.join(relative);
  let root = fs::canonicalize(root)?;
  let path = fs::canonicalize(path)?;
  if !path.starts_with(&root) {
    return Err(Error::Protocol(format!(
      "resource path escapes root: {}",
      path.display()
    )));
  }
  Ok(path)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn lynx_core_requests_use_the_installed_resource() {
    let core_path = std::env::temp_dir().join(format!(
      "headless-rust-test-runner-lynx-core-{}-{}.js",
      std::process::id(),
      std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos()
    ));
    fs::write(&core_path, b"globalThis.loadCard = () => true;").unwrap();
    let mut fetcher = ResourceContext::new(None, core_path.clone()).fetcher();

    let response = fetcher.fetch(ResourceRequest {
      id: 1,
      url: "file:///unrelated/bundle/lynx_core.js".into(),
      resource_type: ResourceType::LynxCoreJs,
    });

    assert_eq!(
      response.data.as_deref(),
      Some(b"globalThis.loadCard = () => true;".as_slice())
    );
    let _ = fs::remove_file(core_path);
  }
}
