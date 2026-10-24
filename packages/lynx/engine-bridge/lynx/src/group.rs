use crate::sys;
use crate::{c_string, Error, LynxEnv, Result};
use std::ffi::CString;
use std::sync::Arc;

/// An owned Lynx runtime group.
///
/// Ownership may move between threads, but a group cannot be shared between
/// threads concurrently.
pub struct LynxGroup {
  sys: Arc<sys::LoadedLibrary>,
  raw: *mut sys::lynx_group_t,
  preload_js_paths: Vec<CString>,
}

// SAFETY: `LynxGroup` uniquely owns its native handle. Moving that ownership
// between threads is allowed, while the raw pointer keeps the wrapper `!Sync`.
unsafe impl Send for LynxGroup {}

impl LynxGroup {
  pub fn new(env: &LynxEnv, name: &str) -> Result<Self> {
    let name = c_string(name, "group_name")?;
    let sys = env.sys().clone();
    let raw = unsafe { (sys.lynx_group_create)(name.as_ptr()) };
    Self::from_raw(sys, raw, "create Lynx group")
  }

  pub fn with_id(env: &LynxEnv, name: &str, id: &str) -> Result<Self> {
    let name = c_string(name, "group_name")?;
    let id = c_string(id, "group_id")?;
    let sys = env.sys().clone();
    let raw = unsafe { (sys.lynx_group_create_with_id)(name.as_ptr(), id.as_ptr()) };
    Self::from_raw(sys, raw, "create Lynx group with id")
  }

  pub fn set_preload_js_paths<I, S>(&mut self, paths: I) -> Result<()>
  where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
  {
    self.preload_js_paths = paths
      .into_iter()
      .map(|path| c_string(path.as_ref(), "preload_js_path"))
      .collect::<Result<_>>()?;
    let raw_paths = self
      .preload_js_paths
      .iter()
      .map(|path| path.as_ptr())
      .collect::<Vec<_>>();
    unsafe {
      (self.sys.lynx_group_set_preload_js_paths)(self.raw, raw_paths.as_ptr(), raw_paths.len());
    }
    Ok(())
  }

  pub fn set_enable_js_group_thread(&mut self, enabled: bool) {
    unsafe {
      (self.sys.lynx_group_set_enable_js_group_thread)(self.raw, i32::from(enabled));
    }
  }

  pub(crate) fn raw(&self) -> *mut sys::lynx_group_t {
    self.raw
  }

  fn from_raw(
    sys: Arc<sys::LoadedLibrary>,
    raw: *mut sys::lynx_group_t,
    operation: &'static str,
  ) -> Result<Self> {
    if raw.is_null() {
      Err(Error::NullPointer { operation })
    } else {
      Ok(Self {
        sys,
        raw,
        preload_js_paths: Vec::new(),
      })
    }
  }
}

impl Drop for LynxGroup {
  fn drop(&mut self) {
    if !self.raw.is_null() {
      unsafe {
        (self.sys.lynx_group_release)(self.raw);
      }
      self.raw = std::ptr::null_mut();
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  static_assertions::assert_impl_all!(LynxGroup: Send);
  static_assertions::assert_not_impl_any!(LynxGroup: Sync);
}
