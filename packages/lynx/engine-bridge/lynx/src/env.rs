use crate::sys;
use crate::{c_str_to_string, c_string, Result};
use std::ffi::c_void;
use std::path::Path;
use std::sync::Arc;

#[derive(Clone)]
pub struct Env {
  library: Arc<sys::LoadedLibrary>,
}

impl Env {
  pub fn load() -> Result<Self> {
    Ok(Self {
      library: Arc::new(sys::LoadedLibrary::load_from_environment()?),
    })
  }

  pub fn load_from_path(path: impl AsRef<Path>) -> Result<Self> {
    Ok(Self {
      library: Arc::new(sys::LoadedLibrary::load(path)?),
    })
  }

  pub fn from_loaded_library(library: sys::LoadedLibrary) -> Self {
    Self {
      library: Arc::new(library),
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

  #[test]
  fn configured_runtime_library_loads() {
    let env = Env::load().expect("configured Lynx runtime library should load");
    assert!(env.sys().path.exists());
    let _ = env.sdk_version();
  }
}
