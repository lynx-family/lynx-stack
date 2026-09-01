use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

use lynx::{FetchResponse, ResourceFetcher, ResourceRequest, ResourceType};
use url::Url;

use crate::{Error, Result};

// The pinned 0.0.4 runtime predates native LynxML background-script bundling
// and still requests this fixed module from the host. This is
// AddAppServiceWrapForJsContent("") from Lynx: the request path has a leading
// slash, while the module id intentionally does not. Keep it in memory so a
// main-thread-only document does not fall through to disk or network.
const EMPTY_LYNX_ML_APP_SERVICE: &[u8] = br#"(function(){
function __init_card_bundle__(lynxCoreInject){
var tt = lynxCoreInject.tt;
tt.define("app-service.js", function(require, module, exports, Card, setTimeout, setInterval, clearInterval, clearTimeout, NativeModules, tt, console, Component, TaroLynx, nativeAppId, Behavior, LynxJSBI, lynx, window, document, frames, self, location, navigator, localStorage, history, Caches, screen, alert, confirm, prompt, fetch, XMLHttpRequest, WebSocket, webkit, Reporter, print, global, requestAnimationFrame, cancelAnimationFrame){

});
tt.require("app-service.js");
}
return {init: __init_card_bundle__};
})();"#;

#[derive(Clone)]
pub(crate) struct ResourceContext {
  navigation: Arc<Mutex<NavigationContext>>,
  resources_path: Option<PathBuf>,
  lynx_core_path: PathBuf,
}

#[derive(Clone, Default)]
struct NavigationContext {
  base_url: String,
  base_dir: Option<PathBuf>,
}

impl ResourceContext {
  pub(crate) fn new(resources_path: Option<PathBuf>, lynx_core_path: PathBuf) -> Self {
    Self {
      navigation: Arc::new(Mutex::new(NavigationContext::default())),
      resources_path,
      lynx_core_path,
    }
  }

  pub(crate) fn set_navigation(&self, base_url: &str, base_dir: Option<PathBuf>) {
    *self
      .navigation
      .lock()
      .expect("navigation context lock poisoned") = NavigationContext {
      base_url: base_url.to_string(),
      base_dir,
    };
  }

  pub(crate) fn fetcher(&self) -> HostResourceFetcher {
    HostResourceFetcher {
      context: self.clone(),
    }
  }

  pub(crate) fn read_template(
    &self,
    input: &str,
    base_dir: Option<&Path>,
  ) -> Result<(String, Vec<u8>, Option<PathBuf>)> {
    let base_dir = base_dir.map(canonicalize_base_dir).transpose()?;
    if is_url_scheme(input, "http") || is_url_scheme(input, "https") {
      reject_network_in_sandbox(base_dir.as_deref())?;
      return Ok((input.to_string(), fetch_http(input)?, base_dir));
    }
    if is_url_scheme(input, "file") {
      let path = resolve_file_url(input, base_dir.as_deref())?;
      let url = if base_dir.is_some() {
        file_url(&path, input)?
      } else {
        input.to_string()
      };
      return Ok((url, fs::read(path)?, base_dir));
    }
    if is_url_scheme(input, "assets") {
      let (url, path) = self.resolve_assets_url(input, base_dir.as_deref())?;
      return Ok((url, fs::read(path)?, base_dir));
    }
    if is_url_scheme(input, "zip") {
      let (url, path) = resolve_virtual_url(input, "zip", base_dir.as_deref())?;
      return Ok((url, fs::read(path)?, base_dir));
    }
    if is_windows_absolute_path(input) {
      if base_dir.is_some() {
        return Err(resource_escape_error());
      }
      let path = fs::canonicalize(input)?;
      let url = file_url(&path, input)?;
      return Ok((url, fs::read(path)?, base_dir));
    }
    reject_unsupported_url_scheme(input)?;

    let path = match base_dir.as_deref() {
      Some(base_dir) => resolve_beneath(base_dir, Path::new(input))?,
      None => fs::canonicalize(input)?,
    };
    let url = file_url(&path, input)?;
    Ok((url, fs::read(path)?, base_dir))
  }

  fn resolve_url(&self, input: &str) -> Result<ResolvedResource> {
    let navigation = self
      .navigation
      .lock()
      .expect("navigation context lock poisoned")
      .clone();
    self.resolve_url_with_navigation(input, &navigation)
  }

  fn resolve_url_with_navigation(
    &self,
    input: &str,
    navigation: &NavigationContext,
  ) -> Result<ResolvedResource> {
    if is_url_scheme(input, "http") || is_url_scheme(input, "https") {
      reject_network_in_sandbox(navigation.base_dir.as_deref())?;
      return Ok(ResolvedResource::Http(input.to_string()));
    }
    if is_url_scheme(input, "file") {
      return resolve_file_url(input, navigation.base_dir.as_deref()).map(ResolvedResource::File);
    }
    if is_url_scheme(input, "assets") {
      let (_, path) = self.resolve_assets_url(input, navigation.base_dir.as_deref())?;
      return Ok(ResolvedResource::File(path));
    }
    if is_url_scheme(input, "zip") {
      let (_, path) = resolve_virtual_url(input, "zip", navigation.base_dir.as_deref())?;
      return Ok(ResolvedResource::File(path));
    }
    if is_windows_absolute_path(input) {
      return match navigation.base_dir.as_deref() {
        Some(_) => Err(resource_escape_error()),
        None => Ok(ResolvedResource::File(PathBuf::from(input))),
      };
    }
    reject_unsupported_url_scheme(input)?;

    if !navigation.base_url.is_empty() {
      let resolved = Url::parse(&navigation.base_url)?.join(input)?;
      if resolved.as_str() == input {
        return Err(Error::Protocol(
          "resource URL did not resolve relative to the current navigation".into(),
        ));
      }
      return self.resolve_url_with_navigation(resolved.as_str(), navigation);
    }
    match navigation.base_dir.as_deref() {
      Some(base_dir) => resolve_beneath(base_dir, Path::new(input)).map(ResolvedResource::File),
      None => Ok(ResolvedResource::File(PathBuf::from(input))),
    }
  }

  fn resolve_assets_url(&self, input: &str, base_dir: Option<&Path>) -> Result<(String, PathBuf)> {
    if base_dir.is_some() {
      return resolve_virtual_url(input, "assets", base_dir);
    }
    let root = self.resources_path.as_ref().ok_or_else(|| {
      Error::Protocol(format!(
        "cannot resolve {input} without ContainerOptions::resources_path"
      ))
    })?;
    let relative = input
      .trim_start_matches("assets://")
      .trim_start_matches('/');
    safe_join(root, relative).map(|path| (input.to_string(), path))
  }

  fn is_lynx_ml_app_service_request(&self, request: &ResourceRequest) -> bool {
    if request.resource_type != ResourceType::ExternalJsSource || request.url != "/app-service.js" {
      return false;
    }
    let navigation = self
      .navigation
      .lock()
      .expect("navigation context lock poisoned");
    crate::is_lynx_ml_url(&navigation.base_url)
  }
}

pub(crate) struct HostResourceFetcher {
  context: ResourceContext,
}

impl ResourceFetcher for HostResourceFetcher {
  fn fetch(&mut self, request: ResourceRequest) -> FetchResponse {
    let result = if is_lynx_core_request(&request) {
      fs::read(&self.context.lynx_core_path).map_err(Error::from)
    } else if self.context.is_lynx_ml_app_service_request(&request) {
      Ok(EMPTY_LYNX_ML_APP_SERVICE.to_vec())
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

fn is_lynx_core_request(request: &ResourceRequest) -> bool {
  if request.resource_type == ResourceType::LynxCoreJs {
    return true;
  }
  request
    .url
    .split(['?', '#'])
    .next()
    .unwrap_or(&request.url)
    .trim_end_matches('/')
    .rsplit('/')
    .next()
    == Some("lynx_core.js")
}

#[derive(Debug)]
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

fn is_url_scheme(input: &str, expected: &str) -> bool {
  input
    .split_once(':')
    .is_some_and(|(scheme, _)| scheme.eq_ignore_ascii_case(expected))
}

fn is_windows_absolute_path(input: &str) -> bool {
  let bytes = input.as_bytes();
  bytes.len() >= 3
    && bytes[0].is_ascii_alphabetic()
    && bytes[1] == b':'
    && matches!(bytes[2], b'/' | b'\\')
}

fn reject_unsupported_url_scheme(input: &str) -> Result<()> {
  let Some((scheme, _)) = input.split_once(':') else {
    return Ok(());
  };
  let mut characters = scheme.chars();
  if !characters
    .next()
    .is_some_and(|value| value.is_ascii_alphabetic())
    || !characters.all(|value| value.is_ascii_alphanumeric() || matches!(value, '+' | '-' | '.'))
  {
    return Ok(());
  }
  Err(Error::Protocol(format!(
    "unsupported resource URL scheme: {scheme}"
  )))
}

fn reject_network_in_sandbox(base_dir: Option<&Path>) -> Result<()> {
  if base_dir.is_some() {
    return Err(Error::Protocol(
      "network resources are not allowed with GotoOptions::base_dir".into(),
    ));
  }
  Ok(())
}

fn canonicalize_base_dir(base_dir: &Path) -> Result<PathBuf> {
  let base_dir = fs::canonicalize(base_dir)?;
  if !base_dir.is_dir() {
    return Err(Error::Protocol(
      "GotoOptions::base_dir must be a directory".into(),
    ));
  }
  Ok(base_dir)
}

fn resolve_file_url(input: &str, base_dir: Option<&Path>) -> Result<PathBuf> {
  let url = Url::parse(input)?;
  if base_dir.is_some() && url.host_str().is_some() {
    return Err(Error::Protocol(
      "file URL hosts are not allowed with GotoOptions::base_dir".into(),
    ));
  }
  let path = url
    .to_file_path()
    .map_err(|_| Error::Protocol(format!("invalid file URL: {input}")))?;
  match base_dir {
    Some(base_dir) => {
      let relative = path
        .strip_prefix(base_dir)
        .map_err(|_| resource_escape_error())?;
      resolve_beneath(base_dir, relative)
    }
    None => Ok(path),
  }
}

fn resolve_virtual_url(
  input: &str,
  expected_scheme: &str,
  base_dir: Option<&Path>,
) -> Result<(String, PathBuf)> {
  let base_dir = base_dir.ok_or_else(|| {
    Error::Protocol(format!(
      "cannot resolve {expected_scheme} URL without GotoOptions::base_dir"
    ))
  })?;
  let (_, suffix) = input
    .split_once("://")
    .filter(|(scheme, _)| scheme.eq_ignore_ascii_case(expected_scheme))
    .ok_or_else(|| Error::Protocol(format!("invalid {expected_scheme} URL")))?;
  let relative_url = suffix.trim_start_matches('/');
  let relative_url_path = relative_url
    .split(['?', '#'])
    .next()
    .unwrap_or(relative_url);
  let relative = percent_decode_path(relative_url_path)?;
  validate_relative_url_path(&relative)?;
  let path = resolve_beneath(base_dir, Path::new(&relative))?;
  let normalized: String = Url::parse(&format!("{expected_scheme}:///{relative_url}"))?.into();
  Ok((normalized, path))
}

fn percent_decode_path(path: &str) -> Result<String> {
  let input = path.as_bytes();
  let mut output = Vec::with_capacity(input.len());
  let mut index = 0;
  while index < input.len() {
    if input[index] != b'%' {
      output.push(input[index]);
      index += 1;
      continue;
    }
    if index + 2 >= input.len() {
      return Err(Error::Protocol(
        "invalid percent escape in resource URL".into(),
      ));
    }
    let high = hex_value(input[index + 1]);
    let low = hex_value(input[index + 2]);
    let (Some(high), Some(low)) = (high, low) else {
      return Err(Error::Protocol(
        "invalid percent escape in resource URL".into(),
      ));
    };
    output.push((high << 4) | low);
    index += 3;
  }
  String::from_utf8(output)
    .map_err(|_| Error::Protocol("resource URL path is not valid UTF-8".into()))
}

fn hex_value(value: u8) -> Option<u8> {
  match value {
    b'0'..=b'9' => Some(value - b'0'),
    b'a'..=b'f' => Some(value - b'a' + 10),
    b'A'..=b'F' => Some(value - b'A' + 10),
    _ => None,
  }
}

fn validate_relative_url_path(relative: &str) -> Result<()> {
  if relative.is_empty()
    || relative.contains('\0')
    || relative.contains('\\')
    || Path::new(relative).is_absolute()
  {
    return Err(Error::Protocol("invalid relative resource URL".into()));
  }
  Ok(())
}

fn file_url(path: &Path, input: &str) -> Result<String> {
  Url::from_file_path(path)
    .map(Into::into)
    .map_err(|_| Error::Protocol(format!("cannot convert path to file URL: {input}")))
}

fn resolve_beneath(base_dir: &Path, path: &Path) -> Result<PathBuf> {
  let relative = normalize_relative_path(path)?;
  let mut path = base_dir.to_path_buf();
  let mut components = relative.components().peekable();
  while let Some(component) = components.next() {
    path.push(component);
    let metadata = fs::symlink_metadata(&path)?;
    if metadata.file_type().is_symlink() {
      return Err(Error::Protocol(
        "symbolic links are not allowed with GotoOptions::base_dir".into(),
      ));
    }
    if components.peek().is_some() && !metadata.is_dir() {
      return Err(Error::Protocol(
        "resource path contains a non-directory component".into(),
      ));
    }
  }

  // The sandbox root is required to remain private and immutable while a page
  // uses it. Under that invariant, the component walk above prevents a
  // symlink swap before this final canonical containment check and read.
  let path = fs::canonicalize(path)?;
  if !path.starts_with(base_dir) {
    return Err(resource_escape_error());
  }
  if !path.is_file() {
    return Err(Error::Protocol(
      "sandboxed resources must be regular files".into(),
    ));
  }
  Ok(path)
}

fn normalize_relative_path(path: &Path) -> Result<PathBuf> {
  let mut normalized = PathBuf::new();
  for component in path.components() {
    match component {
      Component::Normal(component) => normalized.push(component),
      Component::CurDir => {}
      Component::ParentDir => {
        if !normalized.pop() {
          return Err(resource_escape_error());
        }
      }
      Component::Prefix(_) | Component::RootDir => return Err(resource_escape_error()),
    }
  }
  Ok(normalized)
}

fn resource_escape_error() -> Error {
  Error::Protocol("resource path escapes GotoOptions::base_dir".into())
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

  fn resource_context() -> ResourceContext {
    ResourceContext::new(None, PathBuf::from("unused-lynx-core.js"))
  }

  fn as_file_url(path: &Path) -> String {
    Url::from_file_path(path).unwrap().into()
  }

  fn resolved_file(resource: ResolvedResource) -> PathBuf {
    match resource {
      ResolvedResource::File(path) => path,
      ResolvedResource::Http(url) => panic!("expected a file, got {url}"),
    }
  }

  #[test]
  fn zip_urls_treat_authority_as_a_path_below_base_dir() {
    let base = tempfile::tempdir().unwrap();
    let bundle_dir = base.path().join("site");
    fs::create_dir(&bundle_dir).unwrap();
    fs::write(bundle_dir.join("main.lynx.bundle"), b"bundle").unwrap();
    fs::write(bundle_dir.join("image.png"), b"image").unwrap();
    let context = resource_context();

    let (url, bytes, base_dir) = context
      .read_template(
        "zip://site/main.lynx.bundle?version=1#entry",
        Some(base.path()),
      )
      .unwrap();

    assert_eq!(url, "zip:///site/main.lynx.bundle?version=1#entry");
    assert_eq!(bytes, b"bundle");
    context.set_navigation(&url, base_dir);
    assert_eq!(
      resolved_file(context.resolve_url("image.png").unwrap()),
      fs::canonicalize(bundle_dir.join("image.png")).unwrap()
    );
    assert_eq!(
      resolved_file(
        context
          .resolve_url("zip://site/image.png?version=1#resource")
          .unwrap()
      ),
      fs::canonicalize(bundle_dir.join("image.png")).unwrap()
    );
  }

  #[test]
  fn sandbox_rejects_file_urls_outside_base_dir() {
    let parent = tempfile::tempdir().unwrap();
    let base = parent.path().join("base");
    fs::create_dir(&base).unwrap();
    let outside = parent.path().join("outside.lynx.bundle");

    let error = resource_context()
      .read_template(&as_file_url(&outside), Some(&base))
      .unwrap_err();

    assert!(error.to_string().contains("escapes GotoOptions::base_dir"));
  }

  #[test]
  fn sandbox_rejects_absolute_bare_paths_before_access() {
    let base = tempfile::tempdir().unwrap();
    let outside = std::env::temp_dir().join("headless-runner-missing-absolute-resource");

    let error = resource_context()
      .read_template(outside.to_str().unwrap(), Some(base.path()))
      .unwrap_err();

    assert!(error.to_string().contains("escapes GotoOptions::base_dir"));
  }

  #[test]
  fn sandbox_rejects_windows_drive_paths_for_file_and_zip_navigations() {
    let base = tempfile::tempdir().unwrap();
    let canonical_base = fs::canonicalize(base.path()).unwrap();
    let context = resource_context();

    let initial_error = context
      .read_template("C:/outside.lynx.bundle", Some(base.path()))
      .unwrap_err();
    assert!(initial_error
      .to_string()
      .contains("escapes GotoOptions::base_dir"));

    for base_url in [
      as_file_url(&base.path().join("main.lynx.bundle")),
      "zip:///main.lynx.bundle".to_string(),
    ] {
      context.set_navigation(&base_url, Some(canonical_base.clone()));
      for input in ["C:/outside.png", r"C:\outside.png"] {
        let error = context.resolve_url(input).unwrap_err();
        assert!(error.to_string().contains("escapes GotoOptions::base_dir"));
      }
    }
  }

  #[cfg(windows)]
  #[test]
  fn sandbox_rejects_unc_paths_before_access() {
    let base = tempfile::tempdir().unwrap();

    let error = resource_context()
      .read_template(
        r"\\invalid.example.test\share\main.lynx.bundle",
        Some(base.path()),
      )
      .unwrap_err();

    assert!(error.to_string().contains("escapes GotoOptions::base_dir"));
  }

  #[test]
  fn sandbox_rejects_file_url_hosts() {
    let base = tempfile::tempdir().unwrap();

    let error = resource_context()
      .read_template(
        "file://example.test/share/main.lynx.bundle",
        Some(base.path()),
      )
      .unwrap_err();

    assert!(error.to_string().contains("file URL hosts are not allowed"));
  }

  #[test]
  fn sandbox_rejects_relative_traversal_outside_base_dir() {
    let parent = tempfile::tempdir().unwrap();
    let base = parent.path().join("base");
    let nested = base.join("nested");
    fs::create_dir_all(&nested).unwrap();
    let entry = nested.join("main.lynx.bundle");
    fs::write(&entry, b"bundle").unwrap();
    let context = resource_context();
    context.set_navigation(&as_file_url(&entry), Some(fs::canonicalize(&base).unwrap()));

    let initial_error = resource_context()
      .read_template("../outside.png", Some(&base))
      .unwrap_err();
    let resource_error = context.resolve_url("../../outside.png").unwrap_err();

    assert!(initial_error
      .to_string()
      .contains("escapes GotoOptions::base_dir"));
    assert!(resource_error
      .to_string()
      .contains("escapes GotoOptions::base_dir"));
  }

  #[test]
  fn sandbox_resolves_assets_below_base_dir() {
    let parent = tempfile::tempdir().unwrap();
    let base = parent.path().join("base");
    fs::create_dir(&base).unwrap();
    fs::write(base.join("main.lynx.bundle"), b"bundle").unwrap();

    let (url, bytes, _) = resource_context()
      .read_template("assets://main.lynx.bundle", Some(&base))
      .unwrap();
    let error = resource_context()
      .read_template("assets://../outside.lynx.bundle", Some(&base))
      .unwrap_err();

    assert_eq!(url, "assets:///main.lynx.bundle");
    assert_eq!(bytes, b"bundle");
    assert!(error.to_string().contains("escapes GotoOptions::base_dir"));
  }

  #[test]
  fn sandbox_rejects_percent_encoded_zip_traversal() {
    let parent = tempfile::tempdir().unwrap();
    let base = parent.path().join("base");
    fs::create_dir(&base).unwrap();

    let error = resource_context()
      .read_template("zip://%2e%2e/outside.lynx.bundle", Some(base.as_path()))
      .unwrap_err();

    assert!(error.to_string().contains("escapes GotoOptions::base_dir"));
  }

  #[test]
  fn sandbox_rejects_percent_encoded_backslashes() {
    let base = tempfile::tempdir().unwrap();

    let error = resource_context()
      .read_template("zip://dir%5c..%5coutside.lynx.bundle", Some(base.path()))
      .unwrap_err();

    assert!(error.to_string().contains("invalid relative resource URL"));
  }

  #[cfg(unix)]
  #[test]
  fn sandbox_rejects_symlinks_that_escape_base_dir() {
    use std::os::unix::fs::symlink;

    let parent = tempfile::tempdir().unwrap();
    let base = parent.path().join("base");
    fs::create_dir(&base).unwrap();
    let outside = parent.path().join("outside.lynx.bundle");
    symlink(&outside, base.join("escape.lynx.bundle")).unwrap();

    let error = resource_context()
      .read_template("zip://escape.lynx.bundle", Some(&base))
      .unwrap_err();

    assert!(error.to_string().contains("symbolic links are not allowed"));
  }

  #[test]
  fn sandbox_rejects_http_templates_and_resources() {
    let base = tempfile::tempdir().unwrap();
    let context = resource_context();
    let template_error = context
      .read_template("https://example.test/main.lynx.bundle", Some(base.path()))
      .unwrap_err();
    context.set_navigation(
      "zip:///main.lynx.bundle",
      Some(fs::canonicalize(base.path()).unwrap()),
    );
    let resource_error = context
      .resolve_url("HTTP://example.test/image.png")
      .unwrap_err();

    assert!(template_error
      .to_string()
      .contains("network resources are not allowed"));
    assert!(resource_error
      .to_string()
      .contains("network resources are not allowed"));
  }

  #[test]
  fn rejects_unknown_absolute_resource_schemes() {
    let base = tempfile::tempdir().unwrap();
    let context = resource_context();
    context.set_navigation(
      "zip:///main.lynx.bundle",
      Some(fs::canonicalize(base.path()).unwrap()),
    );

    let error = context.resolve_url("data:text/plain,secret").unwrap_err();

    assert!(error
      .to_string()
      .contains("unsupported resource URL scheme: data"));
  }

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

  #[test]
  fn old_runtimes_receive_the_fixed_lynx_ml_app_service_in_memory() {
    let base = tempfile::tempdir().unwrap();
    let context = resource_context();
    context.set_navigation(
      "zip:///index.lynxml",
      Some(fs::canonicalize(base.path()).unwrap()),
    );
    let mut fetcher = context.fetcher();

    let response = fetcher.fetch(ResourceRequest {
      id: 1,
      url: "/app-service.js".into(),
      resource_type: ResourceType::ExternalJsSource,
    });

    assert_eq!(response.code, 0);
    assert_eq!(response.data.as_deref(), Some(EMPTY_LYNX_ML_APP_SERVICE));
    assert!(response.error_message.is_none());
  }

  #[test]
  fn app_service_compatibility_does_not_bypass_other_resource_requests() {
    let base = tempfile::tempdir().unwrap();
    let context = resource_context();
    let base_dir = Some(fs::canonicalize(base.path()).unwrap());
    let request = |url: &str, resource_type| ResourceRequest {
      id: 1,
      url: url.into(),
      resource_type,
    };

    context.set_navigation("zip:///main.lynx.bundle", base_dir.clone());
    let mut fetcher = context.fetcher();
    let compiled = fetcher.fetch(request("/app-service.js", ResourceType::ExternalJsSource));

    context.set_navigation("zip:///index.lynxml", base_dir);
    let generic = fetcher.fetch(request("/app-service.js", ResourceType::Generic));
    let other_script = fetcher.fetch(request("/other.js", ResourceType::ExternalJsSource));

    for response in [compiled, generic, other_script] {
      assert_ne!(response.code, 0);
      assert!(response.data.is_none());
      assert!(response.error_message.is_some());
    }
  }

  #[test]
  fn lynx_core_url_fallback_requires_the_exact_filename() {
    let request = |url: &str, resource_type| ResourceRequest {
      id: 1,
      url: url.into(),
      resource_type,
    };

    assert!(is_lynx_core_request(&request(
      "assets://lynx_core.js?version=1#resource",
      ResourceType::Generic
    )));
    assert!(is_lynx_core_request(&request(
      "assets://unrelated.js",
      ResourceType::LynxCoreJs
    )));
    assert!(!is_lynx_core_request(&request(
      "assets://app_lynx_core.js",
      ResourceType::Generic
    )));
    assert!(!is_lynx_core_request(&request(
      "assets://lynx_core.js.map",
      ResourceType::Generic
    )));
  }
}
