mod buffer;
mod env;
mod error;
mod renderer;
mod resource;
mod view;

pub use env::Env;
pub use error::{Error, Result};
pub use renderer::{
  run_global_ui_task, set_global_ui_task_runner, AcceleratedPaintInfo, AcceleratedRenderer,
  GlRenderer, GlobalUiTaskRunner, NoopHost, SoftwareFrame, SoftwareRenderer, Task, WindowlessHost,
  WindowlessRenderer,
};
pub use resource::{
  FetchResponse, GenericResourceFetcher, ResourceFetcher, ResourceRequest, ResourceType,
};
pub use view::{HeadlessView, HeadlessViewBuilder};

pub use lynx_cpp_bridge::{lynx_key_event_t as KeyEvent, lynx_pointer_event_t as PointerEvent};

fn c_string(value: &str, field: &'static str) -> Result<std::ffi::CString> {
  std::ffi::CString::new(value).map_err(|_| Error::InteriorNul { field })
}

unsafe fn c_str_to_string(ptr: *const std::ffi::c_char) -> String {
  if ptr.is_null() {
    String::new()
  } else {
    std::ffi::CStr::from_ptr(ptr).to_string_lossy().into_owned()
  }
}
