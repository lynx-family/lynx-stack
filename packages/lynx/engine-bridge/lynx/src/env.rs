use crate::sys;
use crate::{c_str_to_string, c_string, Error, Result};
use std::ffi::c_void;
use std::marker::PhantomData;
use std::path::Path;
use std::rc::Rc;
use std::sync::{Arc, Mutex, OnceLock};

static LYNX_ENV: OnceLock<&'static LynxEnv> = OnceLock::new();
static LYNX_ENV_INITIALIZER: Mutex<()> = Mutex::new(());

/// The process-wide Lynx runtime environment.
///
/// The value itself is pinned in a process-global [`OnceLock`]. It cannot be
/// moved to another thread, while shared references may be used concurrently.
pub struct LynxEnv {
  library: Arc<sys::LoadedLibrary>,
  _not_send: PhantomData<Rc<()>>,
}

// SAFETY: `LynxEnv` is initialized once and never moved afterwards. Its only
// state is a `LoadedLibrary`, which is `Sync`; synchronization of process-wide
// native environment operations is provided by the Lynx runtime.
unsafe impl Sync for LynxEnv {}

impl LynxEnv {
  pub fn load() -> Result<&'static Self> {
    Self::initialize(sys::LoadedLibrary::load_from_environment)
  }

  pub fn load_from_path(path: impl AsRef<Path>) -> Result<&'static Self> {
    let requested_path = path.as_ref().to_path_buf();
    let env = Self::initialize(|| sys::LoadedLibrary::load(&requested_path))?;
    Self::ensure_same_runtime(env, requested_path)
  }

  pub fn from_loaded_library(library: sys::LoadedLibrary) -> Result<&'static Self> {
    let requested_path = library.path.clone();
    let env = Self::initialize(|| Ok(library))?;
    Self::ensure_same_runtime(env, requested_path)
  }

  fn initialize(
    load: impl FnOnce() -> std::result::Result<sys::LoadedLibrary, sys::Error>,
  ) -> Result<&'static Self> {
    if let Some(env) = LYNX_ENV.get() {
      return Ok(*env);
    }

    // Serialize the fallible load separately from `OnceLock`: a failed first
    // attempt must not permanently poison process initialization.
    let _guard = LYNX_ENV_INITIALIZER
      .lock()
      .unwrap_or_else(std::sync::PoisonError::into_inner);
    if let Some(env) = LYNX_ENV.get() {
      return Ok(*env);
    }

    let env = &*Box::leak(Box::new(Self {
      library: Arc::new(load()?),
      _not_send: PhantomData,
    }));
    assert!(
      LYNX_ENV.set(env).is_ok(),
      "LynxEnv initialization is serialized"
    );
    Ok(env)
  }

  fn ensure_same_runtime(
    env: &'static Self,
    requested_path: impl AsRef<Path>,
  ) -> Result<&'static Self> {
    let requested_path = requested_path.as_ref();
    if env.library.path == requested_path {
      Ok(env)
    } else {
      Err(Error::LynxEnvAlreadyInitialized {
        loaded_path: env.library.path.clone(),
        requested_path: requested_path.to_path_buf(),
      })
    }
  }

  pub fn sys(&self) -> &Arc<sys::LoadedLibrary> {
    &self.library
  }

  pub fn sdk_version(&self) -> String {
    unsafe { c_str_to_string((self.library.lynx_env_get_sdk_version)()) }
  }

  pub fn icu_data_path(&self) -> String {
    unsafe { c_str_to_string((self.library.lynx_env_get_icu_data_path)()) }
  }

  pub fn set_icu_data_path(&self, path: &str) -> Result<()> {
    let path = c_string(path, "icu_data_path")?;
    unsafe {
      (self.library.lynx_env_set_icu_data_path)(path.as_ptr());
    }
    Ok(())
  }

  pub fn set_devtool_enabled(&self, enabled: bool) {
    unsafe {
      (self.library.lynx_env_enable_devtool)(i32::from(enabled));
    }
  }

  pub fn set_devtool_app_info(&self, name: &str, value: &str) -> Result<()> {
    let name = c_string(name, "devtool_app_info_name")?;
    let value = c_string(value, "devtool_app_info_value")?;
    unsafe {
      (self.library.lynx_env_set_devtool_app_info)(name.as_ptr(), value.as_ptr());
    }
    Ok(())
  }

  pub fn connect_devtool(&self, url: &str) -> Result<bool> {
    let url = c_string(url, "devtool_url")?;
    Ok(unsafe { (self.library.lynx_env_connect_devtool)(url.as_ptr()) != 0 })
  }

  pub fn is_devtool_enabled(&self) -> bool {
    unsafe { (self.library.lynx_env_is_devtool_enabled)() != 0 }
  }

  pub fn set_logbox_enabled(&self, enabled: bool) {
    unsafe {
      (self.library.lynx_env_enable_logbox)(i32::from(enabled));
    }
  }

  pub fn is_logbox_enabled(&self) -> bool {
    unsafe { (self.library.lynx_env_is_logbox_enabled)() != 0 }
  }

  /// Registers a process-wide native module with the loaded Lynx SDK.
  ///
  /// # Safety
  ///
  /// `creator` and `opaque` must obey the native module ABI expected by the
  /// loaded `libLynx`. They must remain valid for as long as Lynx may create
  /// the module.
  pub unsafe fn register_native_module_raw(
    &self,
    name: &str,
    creator: sys::napi_module_creator,
    opaque: *mut c_void,
  ) -> Result<()> {
    let name = c_string(name, "native_module_name")?;
    (self.library.lynx_env_register_native_module)(name.as_ptr(), Some(creator), opaque);
    Ok(())
  }

  /// Registers a process-wide extension module with the loaded Lynx SDK.
  ///
  /// # Safety
  ///
  /// `creator` and `opaque` must obey the extension module ABI expected by
  /// the loaded `libLynx`. They must remain valid for as long as Lynx may
  /// create the module.
  pub unsafe fn register_extension_module_raw(
    &self,
    name: &str,
    creator: sys::extension_module_creator,
    is_lazy_create: bool,
    opaque: *mut c_void,
  ) -> Result<()> {
    let name = c_string(name, "extension_module_name")?;
    (self.library.lynx_env_register_extension_module)(
      name.as_ptr(),
      Some(creator),
      is_lazy_create,
      opaque,
    );
    Ok(())
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  static_assertions::assert_impl_all!(LynxEnv: Sync);
  static_assertions::assert_not_impl_any!(LynxEnv: Send);

  #[test]
  fn configured_runtime_library_loads() {
    let env = LynxEnv::load().expect("configured Lynx runtime library should load");
    assert!(env.sys().path.exists());
    let _ = env.sdk_version();
    assert!(std::ptr::eq(
      env,
      LynxEnv::load().expect("LynxEnv should remain initialized")
    ));
    assert!(std::ptr::eq(
      env,
      LynxEnv::load_from_path(&env.sys().path)
        .expect("the initialized runtime path should resolve to the singleton")
    ));

    let different_path = env.sys().path.with_extension("different-runtime");
    assert!(matches!(
      LynxEnv::load_from_path(&different_path),
      Err(Error::LynxEnvAlreadyInitialized {
        requested_path,
        ..
      }) if requested_path == different_path
    ));
  }
}
