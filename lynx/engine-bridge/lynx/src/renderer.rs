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
  use std::ffi::{CStr, CString};
  use std::ptr::NonNull;
  use std::sync::{Arc, Mutex};

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

  #[test]
  fn software_frame_bytes_returns_none_for_null_allocation() {
    let frame = SoftwareFrame {
      allocation: ptr::null(),
      row_bytes: 4,
      height: 2,
    };

    assert_eq!(unsafe { frame.bytes() }, None);
  }

  #[test]
  fn accelerated_paint_info_copies_raw_fields() {
    let shared_texture_handle = NonNull::<c_void>::dangling().as_ptr();
    let raw = sys::lynx_accelerated_paint_info_t {
      struct_size: std::mem::size_of::<sys::lynx_accelerated_paint_info_t>(),
      shared_texture_handle,
      color_type: sys::kLynxColorTypeBGRA_8888,
      width: 320,
      height: 240,
    };

    let info = AcceleratedPaintInfo::from(raw);
    assert_eq!(info.shared_texture_handle, shared_texture_handle);
    assert_eq!(info.color_type, sys::kLynxColorTypeBGRA_8888);
    assert_eq!(info.width, 320);
    assert_eq!(info.height, 240);
  }

  #[test]
  fn renderer_callbacks_without_context_return_defaults() {
    unsafe {
      assert!(!on_software_present(ptr::null_mut(), ptr::null(), 0, 0));
      assert!(!on_gl_make_current(ptr::null_mut()));
      assert!(!on_gl_clear_current(ptr::null_mut()));
      assert!(!on_gl_present(ptr::null_mut()));
      assert_eq!(on_gl_create_fbo(ptr::null_mut(), 1, 2), 0);
      assert_eq!(
        on_gl_proc_resolver(ptr::null_mut(), ptr::null()),
        ptr::null_mut()
      );
      assert!(!on_accelerated_present(ptr::null_mut()));
      on_post_task(ptr::null_mut(), sys::lynx_task_t::default(), 0);
      assert_eq!(get_clipboard_data(ptr::null_mut()), ptr::null());
      set_clipboard_data(ptr::null_mut(), ptr::null());
      activate_system_cursor(ptr::null_mut(), sys::kLynxCursorTypeBasic, ptr::null());
      show_text_input(ptr::null_mut(), true);
      update_caret_position(ptr::null_mut(), 1.0, 2.0, 3.0, 4.0);
      set_cursor_position(ptr::null_mut(), 5);
      set_marked_text_rect(ptr::null_mut(), 6.0, 7.0, 8.0, 9.0);
      set_editable_transform(ptr::null_mut(), ptr::null());
      assert!(!global_runs_on_current_thread(ptr::null_mut()));
      global_post_task(sys::lynx_task_t::default(), 0, ptr::null_mut());
    }
  }

  #[test]
  fn software_and_host_callbacks_dispatch_to_context() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let presents = Arc::new(Mutex::new(Vec::new()));
    let host = RecordingHost {
      events: events.clone(),
    };
    let renderer = RecordingSoftwareRenderer {
      byte_lengths: presents.clone(),
    };

    with_renderer_context(
      RendererBackend::Software(Box::new(renderer)),
      host,
      |raw| unsafe {
        let frame = [1_u8, 2, 3, 4];
        assert!(on_software_present(raw, frame.as_ptr().cast(), 2, 2));

        on_post_task(
          raw,
          sys::lynx_task_t {
            runner: ptr::null_mut(),
            task: 7,
          },
          42,
        );

        let clipboard = get_clipboard_data(raw);
        assert_eq!(CStr::from_ptr(clipboard).to_str().unwrap(), "clipboard");

        let clipboard_text = CString::new("written").unwrap();
        set_clipboard_data(raw, clipboard_text.as_ptr());

        let cursor_path = CString::new("/tmp/cursor").unwrap();
        activate_system_cursor(raw, sys::kLynxCursorTypeText, cursor_path.as_ptr());
        show_text_input(raw, true);
        update_caret_position(raw, 1.0, 2.0, 3.0, 4.0);
        set_cursor_position(raw, 5);
        set_marked_text_rect(raw, 6.0, 7.0, 8.0, 9.0);

        let transform = [2.0_f32; 16];
        set_editable_transform(raw, transform.as_ptr());
        set_editable_transform(raw, ptr::null());
      },
    );

    assert_eq!(*presents.lock().unwrap(), vec![4]);
    assert_eq!(
      *events.lock().unwrap(),
      vec![
        "post:7:42",
        "clipboard:written",
        "cursor:13:/tmp/cursor",
        "show_text_input:true",
        "caret:1:2:3:4",
        "cursor_position:5",
        "marked_text_rect:6:7:8:9",
        "transform:2",
      ]
    );
  }

  #[test]
  fn gl_callbacks_dispatch_to_context() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let renderer = RecordingGlRenderer {
      events: events.clone(),
    };

    with_renderer_context(
      RendererBackend::Gl(Box::new(renderer)),
      NoopHost,
      |raw| unsafe {
        assert!(on_gl_make_current(raw));
        assert!(on_gl_clear_current(raw));
        assert!(on_gl_present(raw));
        assert_eq!(on_gl_create_fbo(raw, 10, 20), 30);

        let name = CString::new("glBindBuffer").unwrap();
        assert_eq!(on_gl_proc_resolver(raw, name.as_ptr()), ptr::null_mut());
      },
    );

    assert_eq!(
      *events.lock().unwrap(),
      vec![
        "make_current",
        "clear_current",
        "present",
        "create_fbo:10:20",
        "proc:glBindBuffer",
      ]
    );
  }

  #[test]
  fn accelerated_callback_dispatches_to_context() {
    let presents = Arc::new(Mutex::new(0));
    let renderer = RecordingAcceleratedRenderer {
      presents: presents.clone(),
    };

    with_renderer_context(
      RendererBackend::Accelerated(Box::new(renderer)),
      NoopHost,
      |raw| unsafe {
        assert!(on_accelerated_present(raw));
      },
    );

    assert_eq!(*presents.lock().unwrap(), 1);
  }

  #[test]
  fn global_ui_task_runner_callbacks_dispatch_to_context() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let context = Box::new(GlobalUiTaskRunnerContext {
      runner: Mutex::new(Box::new(RecordingGlobalRunner {
        events: events.clone(),
      })),
    });
    let context_ptr = Box::into_raw(context).cast::<c_void>();

    unsafe {
      assert!(global_runs_on_current_thread(context_ptr));
      global_post_task(
        sys::lynx_task_t {
          runner: ptr::null_mut(),
          task: 11,
        },
        99,
        context_ptr,
      );
      drop(Box::from_raw(
        context_ptr.cast::<GlobalUiTaskRunnerContext>(),
      ));
    }

    assert_eq!(
      *events.lock().unwrap(),
      vec!["runs_on_current_thread", "global_post:11:99"]
    );
  }

  fn with_renderer_context<T>(
    backend: RendererBackend,
    host: impl WindowlessHost,
    f: impl FnOnce(*mut sys::lynx_windowless_renderer_t) -> T,
  ) -> T {
    let context = Box::new(RendererContext {
      backend: Mutex::new(backend),
      host: Mutex::new(Box::new(host)),
      clipboard_return: Mutex::new(None),
    });
    let context_ptr = Box::into_raw(context);
    let token_ptr = Box::into_raw(Box::new(0_u8));
    let raw = token_ptr.cast::<sys::lynx_windowless_renderer_t>();
    renderer_contexts()
      .lock()
      .expect("renderer context lock poisoned")
      .insert(raw as usize, context_ptr as usize);

    let result = f(raw);

    renderer_contexts()
      .lock()
      .expect("renderer context lock poisoned")
      .remove(&(raw as usize));
    unsafe {
      drop(Box::from_raw(context_ptr));
      drop(Box::from_raw(token_ptr));
    }
    result
  }

  struct RecordingSoftwareRenderer {
    byte_lengths: Arc<Mutex<Vec<usize>>>,
  }

  impl SoftwareRenderer for RecordingSoftwareRenderer {
    fn present(&mut self, frame: SoftwareFrame) -> bool {
      self
        .byte_lengths
        .lock()
        .unwrap()
        .push(frame.byte_len().unwrap());
      true
    }
  }

  struct RecordingGlRenderer {
    events: Arc<Mutex<Vec<&'static str>>>,
  }

  impl GlRenderer for RecordingGlRenderer {
    fn make_current(&mut self) -> bool {
      self.events.lock().unwrap().push("make_current");
      true
    }

    fn clear_current(&mut self) -> bool {
      self.events.lock().unwrap().push("clear_current");
      true
    }

    fn present(&mut self) -> bool {
      self.events.lock().unwrap().push("present");
      true
    }

    fn create_fbo(&mut self, width: i32, height: i32) -> u32 {
      self.events.lock().unwrap().push("create_fbo:10:20");
      (width + height) as u32
    }

    unsafe fn get_proc_address(&mut self, name: &CStr) -> *mut c_void {
      assert_eq!(name.to_str().unwrap(), "glBindBuffer");
      self.events.lock().unwrap().push("proc:glBindBuffer");
      ptr::null_mut()
    }
  }

  struct RecordingAcceleratedRenderer {
    presents: Arc<Mutex<usize>>,
  }

  impl AcceleratedRenderer for RecordingAcceleratedRenderer {
    fn present(&mut self) -> bool {
      *self.presents.lock().unwrap() += 1;
      true
    }
  }

  struct RecordingHost {
    events: Arc<Mutex<Vec<String>>>,
  }

  impl WindowlessHost for RecordingHost {
    fn post_task(&mut self, task: Task, interval_nanoseconds: u64) {
      self
        .events
        .lock()
        .unwrap()
        .push(format!("post:{}:{interval_nanoseconds}", task.raw().task));
    }

    fn get_clipboard_data(&mut self) -> Option<String> {
      Some("clipboard".into())
    }

    fn set_clipboard_data(&mut self, data: &str) {
      self
        .events
        .lock()
        .unwrap()
        .push(format!("clipboard:{data}"));
    }

    fn activate_system_cursor(&mut self, cursor_type: sys::lynx_cursor_type_e, path: &str) {
      self
        .events
        .lock()
        .unwrap()
        .push(format!("cursor:{cursor_type}:{path}"));
    }

    fn show_text_input(&mut self, show: bool) {
      self
        .events
        .lock()
        .unwrap()
        .push(format!("show_text_input:{show}"));
    }

    fn update_caret_position(&mut self, x: f32, y: f32, width: f32, height: f32) {
      self
        .events
        .lock()
        .unwrap()
        .push(format!("caret:{x}:{y}:{width}:{height}"));
    }

    fn set_cursor_position(&mut self, position: i32) {
      self
        .events
        .lock()
        .unwrap()
        .push(format!("cursor_position:{position}"));
    }

    fn set_marked_text_rect(&mut self, x: f32, y: f32, width: f32, height: f32) {
      self
        .events
        .lock()
        .unwrap()
        .push(format!("marked_text_rect:{x}:{y}:{width}:{height}"));
    }

    fn set_editable_transform(&mut self, transform_matrix: [f32; 16]) {
      self
        .events
        .lock()
        .unwrap()
        .push(format!("transform:{}", transform_matrix[0]));
    }
  }

  struct RecordingGlobalRunner {
    events: Arc<Mutex<Vec<&'static str>>>,
  }

  impl GlobalUiTaskRunner for RecordingGlobalRunner {
    fn runs_on_current_thread(&mut self) -> bool {
      self.events.lock().unwrap().push("runs_on_current_thread");
      true
    }

    fn post_task(&mut self, task: Task, target_time_nanos: u64) {
      assert_eq!(task.raw().task, 11);
      assert_eq!(target_time_nanos, 99);
      self.events.lock().unwrap().push("global_post:11:99");
    }
  }
}
