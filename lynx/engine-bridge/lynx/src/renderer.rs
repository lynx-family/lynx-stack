use crate::sys;
use crate::{c_str_to_string, Env, Error, Result};
use std::collections::HashMap;
use std::ffi::{c_char, c_void, CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::ptr;
use std::sync::{Arc, Mutex, OnceLock};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Task {
  raw: sys::lynx_task_t,
}

unsafe impl Send for Task {}
unsafe impl Sync for Task {}

impl Task {
  pub fn from_raw(raw: sys::lynx_task_t) -> Self {
    Self { raw }
  }

  pub fn raw(self) -> sys::lynx_task_t {
    self.raw
  }
}

#[derive(Clone, Copy, Debug)]
pub struct SoftwareFrame {
  pub allocation: *const c_void,
  pub row_bytes: usize,
  pub height: usize,
}

impl SoftwareFrame {
  pub fn byte_len(self) -> Option<usize> {
    self.row_bytes.checked_mul(self.height)
  }

  /// Returns the frame memory exposed by Lynx for the current present call.
  ///
  /// # Safety
  ///
  /// The returned slice borrows memory owned by Lynx. Callers must only read
  /// it during the `SoftwareRenderer::present` callback that supplied this
  /// frame, unless their embedder contract explicitly extends that lifetime.
  pub unsafe fn bytes<'a>(self) -> Option<&'a [u8]> {
    let len = self.byte_len()?;
    if self.allocation.is_null() {
      return None;
    }
    Some(std::slice::from_raw_parts(
      self.allocation.cast::<u8>(),
      len,
    ))
  }
}

#[derive(Clone, Copy, Debug)]
pub struct AcceleratedPaintInfo {
  pub shared_texture_handle: *mut c_void,
  pub color_type: sys::lynx_color_type_e,
  pub width: u32,
  pub height: u32,
}

impl From<sys::lynx_accelerated_paint_info_t> for AcceleratedPaintInfo {
  fn from(value: sys::lynx_accelerated_paint_info_t) -> Self {
    Self {
      shared_texture_handle: value.shared_texture_handle,
      color_type: value.color_type,
      width: value.width,
      height: value.height,
    }
  }
}

pub trait SoftwareRenderer: Send + 'static {
  fn present(&mut self, frame: SoftwareFrame) -> bool;
}

pub trait GlRenderer: Send + 'static {
  fn make_current(&mut self) -> bool;
  fn clear_current(&mut self) -> bool;
  fn present(&mut self) -> bool;
  fn create_fbo(&mut self, width: i32, height: i32) -> u32;

  /// Resolves a GL function pointer for Lynx.
  ///
  /// # Safety
  ///
  /// The returned pointer must either be null or point to a function with the
  /// exact ABI and lifetime expected by the loaded graphics backend.
  unsafe fn get_proc_address(&mut self, name: &CStr) -> *mut c_void;
}

pub trait AcceleratedRenderer: Send + 'static {
  fn present(&mut self) -> bool;
}

pub trait WindowlessHost: Send + 'static {
  fn post_task(&mut self, _task: Task, _interval_nanoseconds: u64) {}
  fn get_clipboard_data(&mut self) -> Option<String> {
    None
  }
  fn set_clipboard_data(&mut self, _data: &str) {}
  fn activate_system_cursor(&mut self, _cursor_type: sys::lynx_cursor_type_e, _path: &str) {}
  fn show_text_input(&mut self, _show: bool) {}
  fn update_caret_position(&mut self, _x: f32, _y: f32, _width: f32, _height: f32) {}
  fn set_cursor_position(&mut self, _position: i32) {}
  fn set_marked_text_rect(&mut self, _x: f32, _y: f32, _width: f32, _height: f32) {}
  fn set_editable_transform(&mut self, _transform_matrix: [f32; 16]) {}
}

pub struct NoopHost;

impl WindowlessHost for NoopHost {}

enum RendererBackend {
  Software(Box<dyn SoftwareRenderer>),
  Gl(Box<dyn GlRenderer>),
  Accelerated(Box<dyn AcceleratedRenderer>),
}

struct RendererContext {
  backend: Mutex<RendererBackend>,
  host: Mutex<Box<dyn WindowlessHost>>,
  clipboard_return: Mutex<Option<CString>>,
}

fn renderer_contexts() -> &'static Mutex<HashMap<usize, usize>> {
  static CONTEXTS: OnceLock<Mutex<HashMap<usize, usize>>> = OnceLock::new();
  CONTEXTS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub struct WindowlessRenderer {
  sys: Arc<sys::LoadedLibrary>,
  raw: *mut sys::lynx_windowless_renderer_t,
}

impl WindowlessRenderer {
  pub fn software(
    env: &Env,
    renderer: impl SoftwareRenderer,
    host: impl WindowlessHost,
  ) -> Result<Self> {
    Self::create(
      env,
      sys::kRendererTypeSoftware,
      RendererBackend::Software(Box::new(renderer)),
      host,
    )
  }

  pub fn gl(env: &Env, renderer: impl GlRenderer, host: impl WindowlessHost) -> Result<Self> {
    Self::create(
      env,
      sys::kRendererTypeGL,
      RendererBackend::Gl(Box::new(renderer)),
      host,
    )
  }

  pub fn gl_direct(
    env: &Env,
    renderer: impl GlRenderer,
    host: impl WindowlessHost,
  ) -> Result<Self> {
    Self::create(
      env,
      sys::kRendererTypeGLDirect,
      RendererBackend::Gl(Box::new(renderer)),
      host,
    )
  }

  pub fn accelerated(
    env: &Env,
    renderer: impl AcceleratedRenderer,
    host: impl WindowlessHost,
  ) -> Result<Self> {
    Self::create(
      env,
      sys::kRendererTypeAccelerated,
      RendererBackend::Accelerated(Box::new(renderer)),
      host,
    )
  }

  fn create(
    env: &Env,
    renderer_type: sys::lynx_windowless_renderer_type_e,
    backend: RendererBackend,
    host: impl WindowlessHost,
  ) -> Result<Self> {
    let sys = env.sys().clone();
    let context = Box::new(RendererContext {
      backend: Mutex::new(backend),
      host: Mutex::new(Box::new(host)),
      clipboard_return: Mutex::new(None),
    });
    let context_ptr = Box::into_raw(context);
    let raw = unsafe {
      (sys.lynx_windowless_renderer_create_with_finalizer)(
        renderer_type,
        context_ptr.cast::<c_void>(),
        Some(renderer_finalizer),
      )
    };
    if raw.is_null() {
      unsafe {
        drop(Box::from_raw(context_ptr));
      }
      return Err(Error::NullPointer {
        operation: "create windowless renderer",
      });
    }

    renderer_contexts()
      .lock()
      .expect("renderer context lock poisoned")
      .insert(raw as usize, context_ptr as usize);

    unsafe {
      (sys.lynx_windowless_renderer_bind_on_post_task)(raw, Some(on_post_task));
      (sys.lynx_windowless_renderer_bind_get_clipboard_data)(raw, Some(get_clipboard_data));
      (sys.lynx_windowless_renderer_bind_set_clipboard_data)(raw, Some(set_clipboard_data));
      (sys.lynx_windowless_renderer_bind_activate_system_cursor)(raw, Some(activate_system_cursor));
      (sys.lynx_windowless_renderer_bind_show_text_input)(raw, Some(show_text_input));
      (sys.lynx_windowless_renderer_bind_update_caret_position)(raw, Some(update_caret_position));
      (sys.lynx_windowless_renderer_bind_set_cursor_position)(raw, Some(set_cursor_position));
      (sys.lynx_windowless_renderer_bind_set_marked_text_rect)(raw, Some(set_marked_text_rect));
      (sys.lynx_windowless_renderer_bind_set_editable_transform)(raw, Some(set_editable_transform));

      match renderer_type {
        sys::kRendererTypeSoftware => {
          (sys.lynx_windowless_renderer_bind_on_software_present)(raw, Some(on_software_present));
        }
        sys::kRendererTypeGL | sys::kRendererTypeGLDirect => {
          (sys.lynx_windowless_renderer_bind_on_gl_make_current)(raw, Some(on_gl_make_current));
          (sys.lynx_windowless_renderer_bind_on_gl_clear_current)(raw, Some(on_gl_clear_current));
          (sys.lynx_windowless_renderer_bind_on_gl_present)(raw, Some(on_gl_present));
          (sys.lynx_windowless_renderer_bind_on_gl_create_fbo)(raw, Some(on_gl_create_fbo));
          (sys.lynx_windowless_renderer_bind_on_gl_proc_resolver)(raw, Some(on_gl_proc_resolver));
        }
        sys::kRendererTypeAccelerated => {
          (sys.lynx_windowless_renderer_bind_on_accelerated_present)(
            raw,
            Some(on_accelerated_present),
          );
        }
        _ => {}
      }
    }

    Ok(Self { sys, raw })
  }

  pub(crate) fn raw(&self) -> *mut sys::lynx_windowless_renderer_t {
    self.raw
  }

  pub fn run_task(&self, task: Task) {
    unsafe {
      (self.sys.lynx_windowless_renderer_run_task)(self.raw, task.raw());
    }
  }

  pub fn send_pointer_event(&self, mut event: sys::lynx_pointer_event_t) {
    if event.struct_size == 0 {
      event.struct_size = std::mem::size_of::<sys::lynx_pointer_event_t>();
    }
    unsafe {
      (self.sys.lynx_windowless_renderer_send_pointer_event)(self.raw, &mut event);
    }
  }

  pub fn send_key_event(&self, mut event: sys::lynx_key_event_t) {
    if event.struct_size == 0 {
      event.struct_size = std::mem::size_of::<sys::lynx_key_event_t>();
    }
    unsafe {
      (self.sys.lynx_windowless_renderer_send_key_event)(self.raw, &mut event);
    }
  }

  pub fn accelerated_paint_info(&self) -> Option<AcceleratedPaintInfo> {
    let mut info = sys::lynx_accelerated_paint_info_t::default();
    let ok = unsafe {
      (self.sys.lynx_windowless_renderer_get_accelerated_paint_info)(self.raw, &mut info)
    };
    ok.then_some(info.into())
  }
}

impl Drop for WindowlessRenderer {
  fn drop(&mut self) {
    if !self.raw.is_null() {
      unsafe {
        (self.sys.lynx_windowless_renderer_release)(self.raw);
      }
      self.raw = ptr::null_mut();
    }
  }
}

pub trait GlobalUiTaskRunner: Send + 'static {
  fn runs_on_current_thread(&mut self) -> bool;
  fn post_task(&mut self, task: Task, target_time_nanos: u64);
}

struct GlobalUiTaskRunnerContext {
  runner: Mutex<Box<dyn GlobalUiTaskRunner>>,
}

fn global_ui_task_runner_slot() -> &'static Mutex<Option<usize>> {
  static SLOT: OnceLock<Mutex<Option<usize>>> = OnceLock::new();
  SLOT.get_or_init(|| Mutex::new(None))
}

pub fn set_global_ui_task_runner(env: &Env, runner: impl GlobalUiTaskRunner) -> Result<bool> {
  let mut slot = global_ui_task_runner_slot()
    .lock()
    .expect("global UI task runner slot lock poisoned");
  if slot.is_some() {
    return Err(Error::GlobalUiTaskRunnerAlreadySet);
  }

  let context = Box::new(GlobalUiTaskRunnerContext {
    runner: Mutex::new(Box::new(runner)),
  });
  let context_ptr = Box::into_raw(context);
  let config = sys::lynx_windowless_ui_task_runner_config_t {
    struct_size: std::mem::size_of::<sys::lynx_windowless_ui_task_runner_config_t>(),
    user_data: context_ptr.cast::<c_void>(),
    runs_on_current_thread_callback: Some(global_runs_on_current_thread),
    post_task_callback: Some(global_post_task),
  };

  let ok = unsafe { (env.sys().lynx_windowless_set_global_ui_task_runner)(&config) };
  if !ok {
    unsafe {
      drop(Box::from_raw(context_ptr));
    }
    return Ok(false);
  }

  *slot = Some(context_ptr as usize);
  Ok(true)
}

pub fn run_global_ui_task(env: &Env, task: Task) -> bool {
  unsafe { (env.sys().lynx_windowless_run_ui_task)(task.raw()) }
}

unsafe extern "C" fn renderer_finalizer(
  renderer: *mut sys::lynx_windowless_renderer_t,
  user_data: *mut c_void,
) {
  renderer_contexts()
    .lock()
    .expect("renderer context lock poisoned")
    .remove(&(renderer as usize));
  if !user_data.is_null() {
    drop(Box::from_raw(user_data.cast::<RendererContext>()));
  }
}

unsafe fn context_for(
  renderer: *mut sys::lynx_windowless_renderer_t,
) -> Option<&'static RendererContext> {
  let context = renderer_contexts()
    .lock()
    .expect("renderer context lock poisoned")
    .get(&(renderer as usize))
    .copied()?;
  Some(&*(context as *const RendererContext))
}

unsafe extern "C" fn on_software_present(
  renderer: *mut sys::lynx_windowless_renderer_t,
  allocation: *const c_void,
  row_bytes: usize,
  height: usize,
) -> bool {
  let Some(context) = context_for(renderer) else {
    return false;
  };
  catch_unwind(AssertUnwindSafe(|| {
    let mut backend = context
      .backend
      .lock()
      .expect("renderer backend lock poisoned");
    match &mut *backend {
      RendererBackend::Software(renderer) => renderer.present(SoftwareFrame {
        allocation,
        row_bytes,
        height,
      }),
      _ => false,
    }
  }))
  .unwrap_or(false)
}

unsafe extern "C" fn on_gl_make_current(renderer: *mut sys::lynx_windowless_renderer_t) -> bool {
  with_gl_renderer(renderer, |renderer| renderer.make_current()).unwrap_or(false)
}

unsafe extern "C" fn on_gl_clear_current(renderer: *mut sys::lynx_windowless_renderer_t) -> bool {
  with_gl_renderer(renderer, |renderer| renderer.clear_current()).unwrap_or(false)
}

unsafe extern "C" fn on_gl_present(renderer: *mut sys::lynx_windowless_renderer_t) -> bool {
  with_gl_renderer(renderer, |renderer| renderer.present()).unwrap_or(false)
}

unsafe extern "C" fn on_gl_create_fbo(
  renderer: *mut sys::lynx_windowless_renderer_t,
  width: i32,
  height: i32,
) -> u32 {
  with_gl_renderer(renderer, |renderer| renderer.create_fbo(width, height)).unwrap_or(0)
}

unsafe extern "C" fn on_gl_proc_resolver(
  renderer: *mut sys::lynx_windowless_renderer_t,
  name: *const c_char,
) -> *mut c_void {
  if name.is_null() {
    return ptr::null_mut();
  }
  with_gl_renderer(renderer, |renderer| unsafe {
    renderer.get_proc_address(CStr::from_ptr(name))
  })
  .unwrap_or(ptr::null_mut())
}

unsafe fn with_gl_renderer<T>(
  renderer: *mut sys::lynx_windowless_renderer_t,
  f: impl FnOnce(&mut dyn GlRenderer) -> T,
) -> Option<T> {
  let context = context_for(renderer)?;
  catch_unwind(AssertUnwindSafe(|| {
    let mut backend = context
      .backend
      .lock()
      .expect("renderer backend lock poisoned");
    match &mut *backend {
      RendererBackend::Gl(renderer) => Some(f(renderer.as_mut())),
      _ => None,
    }
  }))
  .unwrap_or(None)
}

unsafe extern "C" fn on_accelerated_present(
  renderer: *mut sys::lynx_windowless_renderer_t,
) -> bool {
  let Some(context) = context_for(renderer) else {
    return false;
  };
  catch_unwind(AssertUnwindSafe(|| {
    let mut backend = context
      .backend
      .lock()
      .expect("renderer backend lock poisoned");
    match &mut *backend {
      RendererBackend::Accelerated(renderer) => renderer.present(),
      _ => false,
    }
  }))
  .unwrap_or(false)
}

unsafe extern "C" fn on_post_task(
  renderer: *mut sys::lynx_windowless_renderer_t,
  task: sys::lynx_task_t,
  interval_nanoseconds: u64,
) {
  let Some(context) = context_for(renderer) else {
    return;
  };
  let _ = catch_unwind(AssertUnwindSafe(|| {
    if let Ok(mut host) = context.host.lock() {
      host.post_task(Task::from_raw(task), interval_nanoseconds);
    }
  }));
}

unsafe extern "C" fn get_clipboard_data(
  renderer: *mut sys::lynx_windowless_renderer_t,
) -> *const c_char {
  let Some(context) = context_for(renderer) else {
    return ptr::null();
  };
  catch_unwind(AssertUnwindSafe(|| {
    let value = context
      .host
      .lock()
      .ok()
      .and_then(|mut host| host.get_clipboard_data())
      .and_then(|value| CString::new(value).ok());
    let ptr = value
      .as_ref()
      .map(|value| value.as_ptr())
      .unwrap_or(ptr::null());
    if let Ok(mut clipboard_return) = context.clipboard_return.lock() {
      *clipboard_return = value;
    }
    ptr
  }))
  .unwrap_or(ptr::null())
}

unsafe extern "C" fn set_clipboard_data(
  renderer: *mut sys::lynx_windowless_renderer_t,
  data: *const c_char,
) {
  let Some(context) = context_for(renderer) else {
    return;
  };
  let data = c_str_to_string(data);
  let _ = catch_unwind(AssertUnwindSafe(|| {
    if let Ok(mut host) = context.host.lock() {
      host.set_clipboard_data(&data);
    }
  }));
}

unsafe extern "C" fn activate_system_cursor(
  renderer: *mut sys::lynx_windowless_renderer_t,
  cursor_type: sys::lynx_cursor_type_e,
  path: *const c_char,
) {
  let Some(context) = context_for(renderer) else {
    return;
  };
  let path = c_str_to_string(path);
  let _ = catch_unwind(AssertUnwindSafe(|| {
    if let Ok(mut host) = context.host.lock() {
      host.activate_system_cursor(cursor_type, &path);
    }
  }));
}

unsafe extern "C" fn show_text_input(renderer: *mut sys::lynx_windowless_renderer_t, show: bool) {
  let Some(context) = context_for(renderer) else {
    return;
  };
  let _ = catch_unwind(AssertUnwindSafe(|| {
    if let Ok(mut host) = context.host.lock() {
      host.show_text_input(show);
    }
  }));
}

unsafe extern "C" fn update_caret_position(
  renderer: *mut sys::lynx_windowless_renderer_t,
  x: f32,
  y: f32,
  width: f32,
  height: f32,
) {
  let Some(context) = context_for(renderer) else {
    return;
  };
  let _ = catch_unwind(AssertUnwindSafe(|| {
    if let Ok(mut host) = context.host.lock() {
      host.update_caret_position(x, y, width, height);
    }
  }));
}

unsafe extern "C" fn set_cursor_position(
  renderer: *mut sys::lynx_windowless_renderer_t,
  position: i32,
) {
  let Some(context) = context_for(renderer) else {
    return;
  };
  let _ = catch_unwind(AssertUnwindSafe(|| {
    if let Ok(mut host) = context.host.lock() {
      host.set_cursor_position(position);
    }
  }));
}

unsafe extern "C" fn set_marked_text_rect(
  renderer: *mut sys::lynx_windowless_renderer_t,
  x: f32,
  y: f32,
  width: f32,
  height: f32,
) {
  let Some(context) = context_for(renderer) else {
    return;
  };
  let _ = catch_unwind(AssertUnwindSafe(|| {
    if let Ok(mut host) = context.host.lock() {
      host.set_marked_text_rect(x, y, width, height);
    }
  }));
}

unsafe extern "C" fn set_editable_transform(
  renderer: *mut sys::lynx_windowless_renderer_t,
  transform_matrix: *const f32,
) {
  let Some(context) = context_for(renderer) else {
    return;
  };
  if transform_matrix.is_null() {
    return;
  }
  let mut matrix = [0.0_f32; 16];
  matrix.copy_from_slice(std::slice::from_raw_parts(transform_matrix, 16));
  let _ = catch_unwind(AssertUnwindSafe(|| {
    if let Ok(mut host) = context.host.lock() {
      host.set_editable_transform(matrix);
    }
  }));
}

unsafe extern "C" fn global_runs_on_current_thread(user_data: *mut c_void) -> bool {
  if user_data.is_null() {
    return false;
  }
  let context = &*(user_data.cast::<GlobalUiTaskRunnerContext>());
  catch_unwind(AssertUnwindSafe(|| {
    context
      .runner
      .lock()
      .map(|mut runner| runner.runs_on_current_thread())
      .unwrap_or(false)
  }))
  .unwrap_or(false)
}

unsafe extern "C" fn global_post_task(
  task: sys::lynx_task_t,
  target_time_nanos: u64,
  user_data: *mut c_void,
) {
  if user_data.is_null() {
    return;
  }
  let context = &*(user_data.cast::<GlobalUiTaskRunnerContext>());
  let _ = catch_unwind(AssertUnwindSafe(|| {
    if let Ok(mut runner) = context.runner.lock() {
      runner.post_task(Task::from_raw(task), target_time_nanos);
    }
  }));
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn software_frame_len_is_checked() {
    let frame = SoftwareFrame {
      allocation: ptr::null(),
      row_bytes: usize::MAX,
      height: 2,
    };
    assert_eq!(frame.byte_len(), None);
  }

  #[test]
  fn task_round_trips_raw_value() {
    let raw = sys::lynx_task_t {
      runner: ptr::null_mut(),
      task: 42,
    };
    assert_eq!(Task::from_raw(raw).raw(), raw);
  }
}
