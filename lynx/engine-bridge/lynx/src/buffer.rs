use crate::sys;
use std::ffi::c_void;
use std::ptr;

pub(crate) struct CByteBuffer {
  ptr: *mut u8,
  len: usize,
}

impl CByteBuffer {
  pub(crate) fn copy_from_slice(bytes: &[u8]) -> Self {
    Self::from_vec(bytes.to_vec())
  }

  pub(crate) fn from_vec(bytes: Vec<u8>) -> Self {
    let len = bytes.len();
    let ptr = Box::into_raw(bytes.into_boxed_slice()) as *mut u8;
    Self { ptr, len }
  }

  pub(crate) fn into_ffi(mut self) -> (*mut u8, usize, Option<sys::binary_data_dtor>, *mut c_void) {
    let ptr = self.ptr;
    let len = self.len;
    self.ptr = ptr::null_mut();
    self.len = 0;
    (ptr, len, Some(release_c_byte_buffer), ptr::null_mut())
  }
}

impl Drop for CByteBuffer {
  fn drop(&mut self) {
    if !self.ptr.is_null() {
      unsafe {
        drop(Box::from_raw(ptr::slice_from_raw_parts_mut(
          self.ptr, self.len,
        )));
      }
      self.ptr = ptr::null_mut();
      self.len = 0;
    }
  }
}

unsafe extern "C" fn release_c_byte_buffer(content: *mut u8, length: usize, _opaque: *mut c_void) {
  if !content.is_null() {
    drop(Box::from_raw(ptr::slice_from_raw_parts_mut(
      content, length,
    )));
  }
}
