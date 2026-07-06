use crate::sys;
use crate::{buffer::CByteBuffer, c_str_to_string, Env, Error, Result};
use std::collections::HashMap;
use std::ffi::{c_void, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::{Arc, Mutex, OnceLock};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ResourceRequest {
  pub id: sys::lynx_resource_request_id,
  pub url: String,
  pub resource_type: ResourceType,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ResourceType {
  Generic,
  Image,
  Font,
  Lottie,
  Video,
  Svg,
  Template,
  LynxCoreJs,
  LazyBundle,
  I18nText,
  Theme,
  ExternalJsSource,
  ExternalByteCode,
  Assets,
  Unknown(i32),
}

impl From<sys::lynx_resource_type_e> for ResourceType {
  fn from(value: sys::lynx_resource_type_e) -> Self {
    match value {
      sys::kLynxResourceTypeGeneric => Self::Generic,
      sys::kLynxResourceTypeImage => Self::Image,
      sys::kLynxResourceTypeFont => Self::Font,
      sys::kLynxResourceTypeLottie => Self::Lottie,
      sys::kLynxResourceTypeVideo => Self::Video,
      sys::kLynxResourceTypeSVG => Self::Svg,
      sys::kLynxResourceTypeTemplate => Self::Template,
      sys::kLynxResourceTypeLynxCoreJS => Self::LynxCoreJs,
      sys::kLynxResourceTypeLazyBundle => Self::LazyBundle,
      sys::kLynxResourceTypeI18NText => Self::I18nText,
      sys::kLynxResourceTypeTheme => Self::Theme,
      sys::kLynxResourceTypeExternalJSSource => Self::ExternalJsSource,
      sys::kLynxResourceTypeExternalByteCode => Self::ExternalByteCode,
      sys::kLynxResourceTypeAssets => Self::Assets,
      other => Self::Unknown(other),
    }
  }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FetchResponse {
  pub code: i32,
  pub data: Option<Vec<u8>>,
  pub error_message: Option<String>,
}

impl FetchResponse {
  pub fn ok(data: impl Into<Vec<u8>>) -> Self {
    Self {
      code: 0,
      data: Some(data.into()),
      error_message: None,
    }
  }

  pub fn empty_ok() -> Self {
    Self {
      code: 0,
      data: None,
      error_message: None,
    }
  }

  pub fn error(code: i32, message: impl Into<String>) -> Self {
    Self {
      code,
      data: None,
      error_message: Some(message.into()),
    }
  }
}

pub trait ResourceFetcher: Send + 'static {
  fn fetch(&mut self, request: ResourceRequest) -> FetchResponse;

  fn fetch_path(&mut self, request: ResourceRequest) -> FetchResponse {
    self.fetch(request)
  }

  fn cancel(&mut self, _request_id: sys::lynx_resource_request_id) {}
}

struct ResourceFetcherContext {
  sys: Arc<sys::LoadedLibrary>,
  fetcher: Mutex<Box<dyn ResourceFetcher>>,
}

fn contexts() -> &'static Mutex<HashMap<usize, Arc<ResourceFetcherContext>>> {
  static CONTEXTS: OnceLock<Mutex<HashMap<usize, Arc<ResourceFetcherContext>>>> = OnceLock::new();
  CONTEXTS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub struct GenericResourceFetcher {
  sys: Arc<sys::LoadedLibrary>,
  raw: *mut sys::lynx_generic_resource_fetcher_t,
}

impl GenericResourceFetcher {
  pub fn new(fetch_env: &Env, fetcher: impl ResourceFetcher) -> Result<Self> {
    let sys = fetch_env.sys().clone();
    let context = Arc::new(ResourceFetcherContext {
      sys: sys.clone(),
      fetcher: Mutex::new(Box::new(fetcher)),
    });
    let context_ptr = Arc::into_raw(context.clone());
    let raw = unsafe {
      (sys.lynx_generic_resource_fetcher_create_with_finalizer)(
        context_ptr as *mut c_void,
        Some(resource_fetcher_finalizer),
      )
    };
    if raw.is_null() {
      unsafe {
        drop(Arc::from_raw(context_ptr));
      }
      return Err(Error::NullPointer {
        operation: "create generic resource fetcher",
      });
    }

    contexts()
      .lock()
      .expect("resource fetcher context lock poisoned")
      .insert(raw as usize, context);

    unsafe {
      (sys.lynx_generic_resource_fetcher_bind_fetch_resource)(raw, Some(fetch_resource));
      (sys.lynx_generic_resource_fetcher_bind_fetch_resource_path)(raw, Some(fetch_path));
      (sys.lynx_generic_resource_fetcher_bind_cancel_fetch)(raw, Some(cancel_fetch));
    }

    Ok(Self { sys, raw })
  }

  pub(crate) fn raw(&self) -> *mut sys::lynx_generic_resource_fetcher_t {
    self.raw
  }
}

impl Drop for GenericResourceFetcher {
  fn drop(&mut self) {
    if !self.raw.is_null() {
      unsafe {
        (self.sys.lynx_generic_resource_fetcher_release)(self.raw);
      }
      self.raw = std::ptr::null_mut();
    }
  }
}

unsafe extern "C" fn resource_fetcher_finalizer(
  fetcher: *mut sys::lynx_generic_resource_fetcher_t,
  user_data: *mut c_void,
) {
  let _ = catch_unwind(AssertUnwindSafe(|| {
    contexts()
      .lock()
      .expect("resource fetcher context lock poisoned")
      .remove(&(fetcher as usize));
    if !user_data.is_null() {
      drop(Arc::from_raw(user_data.cast::<ResourceFetcherContext>()));
    }
  }));
}

unsafe extern "C" fn fetch_resource(
  fetcher: *mut sys::lynx_generic_resource_fetcher_t,
  request: *mut sys::lynx_resource_request_t,
  response: *mut sys::lynx_resource_response_t,
) {
  complete_fetch(fetcher, request, response, false);
}

unsafe extern "C" fn fetch_path(
  fetcher: *mut sys::lynx_generic_resource_fetcher_t,
  request: *mut sys::lynx_resource_request_t,
  response: *mut sys::lynx_resource_response_t,
) {
  complete_fetch(fetcher, request, response, true);
}

unsafe extern "C" fn cancel_fetch(
  fetcher: *mut sys::lynx_generic_resource_fetcher_t,
  request_id: sys::lynx_resource_request_id,
) {
  let Some(context) = context_for(fetcher) else {
    return;
  };
  let _ = catch_unwind(AssertUnwindSafe(|| {
    if let Ok(mut fetcher) = context.fetcher.lock() {
      fetcher.cancel(request_id);
    }
  }));
}

unsafe fn complete_fetch(
  fetcher: *mut sys::lynx_generic_resource_fetcher_t,
  request: *mut sys::lynx_resource_request_t,
  response: *mut sys::lynx_resource_response_t,
  path_only: bool,
) {
  let Some(context) = context_for(fetcher) else {
    return;
  };
  let request_info = read_request(&context, request);
  let outcome = catch_unwind(AssertUnwindSafe(|| {
    let mut fetcher = context
      .fetcher
      .lock()
      .expect("resource fetcher lock poisoned");
    if path_only {
      fetcher.fetch_path(request_info)
    } else {
      fetcher.fetch(request_info)
    }
  }))
  .unwrap_or_else(|_| FetchResponse::error(-1, "resource fetcher panicked"));
  write_response(&context, response, outcome);
  release_request_response(&context, request, response);
}

unsafe fn context_for(
  fetcher: *mut sys::lynx_generic_resource_fetcher_t,
) -> Option<Arc<ResourceFetcherContext>> {
  contexts()
    .lock()
    .expect("resource fetcher context lock poisoned")
    .get(&(fetcher as usize))
    .cloned()
}

unsafe fn read_request(
  context: &ResourceFetcherContext,
  request: *mut sys::lynx_resource_request_t,
) -> ResourceRequest {
  if request.is_null() {
    return ResourceRequest {
      id: 0,
      url: String::new(),
      resource_type: ResourceType::Unknown(-1),
    };
  }
  ResourceRequest {
    id: (context.sys.lynx_resource_request_get_id)(request),
    url: c_str_to_string((context.sys.lynx_resource_request_get_url)(request)),
    resource_type: (context.sys.lynx_resource_request_get_type)(request).into(),
  }
}

unsafe fn write_response(
  context: &ResourceFetcherContext,
  response: *mut sys::lynx_resource_response_t,
  outcome: FetchResponse,
) {
  if response.is_null() {
    return;
  }
  (context.sys.lynx_resource_response_set_code)(response, outcome.code);
  if let Some(message) = outcome.error_message {
    if let Ok(message) = CString::new(message) {
      (context.sys.lynx_resource_response_set_error_message)(response, message.as_ptr());
    }
  }
  if let Some(data) = outcome.data {
    let (ptr, len, dtor, opaque) = CByteBuffer::from_vec(data).into_ffi();
    (context.sys.lynx_resource_response_set_data)(response, ptr, len, dtor, opaque);
  }
}

unsafe fn release_request_response(
  context: &ResourceFetcherContext,
  request: *mut sys::lynx_resource_request_t,
  response: *mut sys::lynx_resource_response_t,
) {
  if !response.is_null() {
    (context.sys.lynx_resource_response_callback)(response);
    (context.sys.lynx_resource_response_release)(response);
  }
  if !request.is_null() {
    (context.sys.lynx_resource_request_release)(request);
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn fetch_response_builders_are_plain_data() {
    assert_eq!(FetchResponse::ok([1, 2, 3]).code, 0);
    assert_eq!(FetchResponse::empty_ok().data, None);
    assert_eq!(
      FetchResponse::error(-1, "nope").error_message.as_deref(),
      Some("nope")
    );
  }

  #[test]
  fn resource_type_maps_known_and_unknown_values() {
    let cases = [
      (sys::kLynxResourceTypeGeneric, ResourceType::Generic),
      (sys::kLynxResourceTypeImage, ResourceType::Image),
      (sys::kLynxResourceTypeFont, ResourceType::Font),
      (sys::kLynxResourceTypeLottie, ResourceType::Lottie),
      (sys::kLynxResourceTypeVideo, ResourceType::Video),
      (sys::kLynxResourceTypeSVG, ResourceType::Svg),
      (sys::kLynxResourceTypeTemplate, ResourceType::Template),
      (sys::kLynxResourceTypeLynxCoreJS, ResourceType::LynxCoreJs),
      (sys::kLynxResourceTypeLazyBundle, ResourceType::LazyBundle),
      (sys::kLynxResourceTypeI18NText, ResourceType::I18nText),
      (sys::kLynxResourceTypeTheme, ResourceType::Theme),
      (
        sys::kLynxResourceTypeExternalJSSource,
        ResourceType::ExternalJsSource,
      ),
      (
        sys::kLynxResourceTypeExternalByteCode,
        ResourceType::ExternalByteCode,
      ),
      (sys::kLynxResourceTypeAssets, ResourceType::Assets),
      (999, ResourceType::Unknown(999)),
    ];

    for (raw, expected) in cases {
      assert_eq!(ResourceType::from(raw), expected);
    }
  }

  #[test]
  fn resource_fetcher_default_methods_delegate_or_noop() {
    struct EchoFetcher;

    impl ResourceFetcher for EchoFetcher {
      fn fetch(&mut self, request: ResourceRequest) -> FetchResponse {
        FetchResponse::ok(request.url)
      }
    }

    let mut fetcher = EchoFetcher;
    let response = fetcher.fetch_path(ResourceRequest {
      id: 7,
      url: "memory://asset".into(),
      resource_type: ResourceType::Assets,
    });

    assert_eq!(response.data, Some(b"memory://asset".to_vec()));
    fetcher.cancel(7);
  }
}
