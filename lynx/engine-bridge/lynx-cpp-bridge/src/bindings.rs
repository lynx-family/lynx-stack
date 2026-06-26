use std::ffi::{c_char, c_int, c_void};

macro_rules! opaque {
  ($name:ident) => {
    #[repr(C)]
    pub struct $name {
      _private: [u8; 0],
    }
  };
}

opaque!(lynx_view_builder_t);
opaque!(lynx_view_t);
opaque!(lynx_windowless_renderer_t);
opaque!(lynx_generic_resource_fetcher_t);
opaque!(lynx_resource_request_t);
opaque!(lynx_resource_response_t);
opaque!(lynx_template_data_t);
opaque!(lynx_template_bundle_t);
opaque!(lynx_load_meta_t);
opaque!(lynx_update_meta_t);
opaque!(lynx_extension_module_t);
opaque!(lynx_vsync_observer_t);
opaque!(lynx_event_reporter_service_t);

pub type NativeWindow = *mut c_void;
pub type napi_env = *mut c_void;
pub type napi_value = *mut c_void;
pub type napi_status = c_int;
pub type lynx_resource_request_id = u64;
pub type lynx_cursor_type_e = c_int;
pub type lynx_windowless_renderer_type_e = c_int;
pub type lynx_resource_type_e = c_int;
pub type lynx_pointer_phase_e = c_int;
pub type lynx_pointer_signal_kind_e = c_int;
pub type lynx_pointer_device_kind_e = c_int;
pub type lynx_key_event_type_e = c_int;
pub type lynx_color_type_e = c_int;
pub type lynx_value_type = u8;

pub const kRendererTypeSoftware: lynx_windowless_renderer_type_e = 0;
pub const kRendererTypeGL: lynx_windowless_renderer_type_e = 1;
pub const kRendererTypeGLDirect: lynx_windowless_renderer_type_e = 2;
pub const kRendererTypeAccelerated: lynx_windowless_renderer_type_e = 3;

pub const kLynxResourceTypeGeneric: lynx_resource_type_e = 0;
pub const kLynxResourceTypeImage: lynx_resource_type_e = 1;
pub const kLynxResourceTypeFont: lynx_resource_type_e = 2;
pub const kLynxResourceTypeLottie: lynx_resource_type_e = 3;
pub const kLynxResourceTypeVideo: lynx_resource_type_e = 4;
pub const kLynxResourceTypeSVG: lynx_resource_type_e = 5;
pub const kLynxResourceTypeTemplate: lynx_resource_type_e = 6;
pub const kLynxResourceTypeLynxCoreJS: lynx_resource_type_e = 7;
pub const kLynxResourceTypeLazyBundle: lynx_resource_type_e = 8;
pub const kLynxResourceTypeI18NText: lynx_resource_type_e = 9;
pub const kLynxResourceTypeTheme: lynx_resource_type_e = 10;
pub const kLynxResourceTypeExternalJSSource: lynx_resource_type_e = 11;
pub const kLynxResourceTypeExternalByteCode: lynx_resource_type_e = 12;
pub const kLynxResourceTypeAssets: lynx_resource_type_e = 13;

pub const kLynxPointerPhaseCancel: lynx_pointer_phase_e = 0;
pub const kLynxPointerPhaseUp: lynx_pointer_phase_e = 1;
pub const kLynxPointerPhaseDown: lynx_pointer_phase_e = 2;
pub const kLynxPointerPhaseMove: lynx_pointer_phase_e = 3;
pub const kLynxPointerPhaseAdd: lynx_pointer_phase_e = 4;
pub const kLynxPointerPhaseRemove: lynx_pointer_phase_e = 5;
pub const kLynxPointerPhaseHover: lynx_pointer_phase_e = 6;
pub const kLynxPointerPhasePanZoomStart: lynx_pointer_phase_e = 7;
pub const kLynxPointerPhasePanZoomUpdate: lynx_pointer_phase_e = 8;
pub const kLynxPointerPhasePanZoomEnd: lynx_pointer_phase_e = 9;

pub const kLynxPointerSignalKindNone: lynx_pointer_signal_kind_e = 0;
pub const kLynxPointerSignalKindScroll: lynx_pointer_signal_kind_e = 1;
pub const kLynxPointerSignalKindScrollInertiaCancel: lynx_pointer_signal_kind_e = 2;
pub const kLynxPointerSignalKindScale: lynx_pointer_signal_kind_e = 3;

pub const kLynxPointerDeviceKindMouse: lynx_pointer_device_kind_e = 1;
pub const kLynxPointerDeviceKindTouch: lynx_pointer_device_kind_e = 2;
pub const kLynxPointerDeviceKindStylus: lynx_pointer_device_kind_e = 3;
pub const kLynxPointerDeviceKindTrackpad: lynx_pointer_device_kind_e = 4;

pub const kLynxKeyEventTypeUp: lynx_key_event_type_e = 1;
pub const kLynxKeyEventTypeDown: lynx_key_event_type_e = 2;
pub const kLynxKeyEventTypeRepeat: lynx_key_event_type_e = 3;

pub const kLynxCursorTypeUnknown: lynx_cursor_type_e = 1;
pub const kLynxCursorTypeNet: lynx_cursor_type_e = 2;
pub const kLynxCursorTypeFile: lynx_cursor_type_e = 3;
pub const kLynxCursorTypeAuto: lynx_cursor_type_e = 4;
pub const kLynxCursorTypeNone: lynx_cursor_type_e = 5;
pub const kLynxCursorTypeBasic: lynx_cursor_type_e = 6;
pub const kLynxCursorTypeClick: lynx_cursor_type_e = 7;
pub const kLynxCursorTypeForbidden: lynx_cursor_type_e = 8;
pub const kLynxCursorTypeWait: lynx_cursor_type_e = 9;
pub const kLynxCursorTypeProgress: lynx_cursor_type_e = 10;
pub const kLynxCursorTypeContextmenu: lynx_cursor_type_e = 11;
pub const kLynxCursorTypeHelp: lynx_cursor_type_e = 12;
pub const kLynxCursorTypeText: lynx_cursor_type_e = 13;
pub const kLynxCursorTypeVerticalText: lynx_cursor_type_e = 14;
pub const kLynxCursorTypeCell: lynx_cursor_type_e = 15;
pub const kLynxCursorTypePrecise: lynx_cursor_type_e = 16;
pub const kLynxCursorTypeMove: lynx_cursor_type_e = 17;
pub const kLynxCursorTypeGrab: lynx_cursor_type_e = 18;

pub const kLynxColorTypeRGBA_8888: lynx_color_type_e = 0;
pub const kLynxColorTypeBGRA_8888: lynx_color_type_e = 1;

pub const lynx_value_null: lynx_value_type = 0;
pub const lynx_value_undefined: lynx_value_type = 1;
pub const lynx_value_bool: lynx_value_type = 2;
pub const lynx_value_double: lynx_value_type = 3;
pub const lynx_value_int32: lynx_value_type = 4;
pub const lynx_value_uint32: lynx_value_type = 5;
pub const lynx_value_int64: lynx_value_type = 6;
pub const lynx_value_uint64: lynx_value_type = 7;
pub const lynx_value_nan: lynx_value_type = 8;
pub const lynx_value_string: lynx_value_type = 9;
pub const lynx_value_array: lynx_value_type = 10;
pub const lynx_value_map: lynx_value_type = 11;
pub const lynx_value_arraybuffer: lynx_value_type = 12;
pub const lynx_value_object: lynx_value_type = 13;
pub const lynx_value_function: lynx_value_type = 14;
pub const lynx_value_function_table: lynx_value_type = 15;
pub const lynx_value_external: lynx_value_type = 16;
pub const lynx_value_extended: lynx_value_type = 17;

#[repr(C)]
#[derive(Copy, Clone)]
pub union lynx_value_storage {
  pub val_bool: bool,
  pub val_double: f64,
  pub val_int32: i32,
  pub val_uint32: u32,
  pub val_int64: i64,
  pub val_uint64: u64,
  pub val_ptr: *mut c_void,
}

#[repr(C)]
#[derive(Copy, Clone)]
pub struct lynx_value {
  pub storage: lynx_value_storage,
  pub type_: lynx_value_type,
  pub __unnamed0__: u8,
  pub __unnamed1__: u8,
  pub __unnamed2__: u8,
  pub tag: i32,
}

#[repr(C)]
#[derive(Copy, Clone, Debug, Default, Eq, PartialEq)]
pub struct lynx_task_t {
  pub runner: *mut c_void,
  pub task: u64,
}

#[repr(C)]
#[derive(Copy, Clone, Debug)]
pub struct lynx_pointer_event_t {
  pub struct_size: usize,
  pub phase: lynx_pointer_phase_e,
  pub timestamp: usize,
  pub x: f64,
  pub y: f64,
  pub device: i32,
  pub signal_kind: lynx_pointer_signal_kind_e,
  pub scroll_delta_x: f64,
  pub scroll_delta_y: f64,
  pub device_kind: lynx_pointer_device_kind_e,
  pub buttons: i64,
  pub pan_x: f64,
  pub pan_y: f64,
  pub scale: f64,
  pub rotation: f64,
  pub is_precise_scroll: usize,
}

impl Default for lynx_pointer_event_t {
  fn default() -> Self {
    Self {
      struct_size: std::mem::size_of::<Self>(),
      phase: kLynxPointerPhaseCancel,
      timestamp: 0,
      x: 0.0,
      y: 0.0,
      device: 0,
      signal_kind: kLynxPointerSignalKindNone,
      scroll_delta_x: 0.0,
      scroll_delta_y: 0.0,
      device_kind: kLynxPointerDeviceKindMouse,
      buttons: 0,
      pan_x: 0.0,
      pan_y: 0.0,
      scale: 1.0,
      rotation: 0.0,
      is_precise_scroll: 0,
    }
  }
}

#[repr(C)]
#[derive(Copy, Clone, Debug)]
pub struct lynx_key_event_t {
  pub struct_size: usize,
  pub timestamp: f64,
  pub type_: lynx_key_event_type_e,
  pub physical: u64,
  pub logical: u64,
  pub character: *const c_char,
  pub synthesized: bool,
}

impl Default for lynx_key_event_t {
  fn default() -> Self {
    Self {
      struct_size: std::mem::size_of::<Self>(),
      timestamp: 0.0,
      type_: kLynxKeyEventTypeDown,
      physical: 0,
      logical: 0,
      character: std::ptr::null(),
      synthesized: false,
    }
  }
}

#[repr(C)]
#[derive(Copy, Clone, Debug)]
pub struct lynx_accelerated_paint_info_t {
  pub struct_size: usize,
  pub shared_texture_handle: *mut c_void,
  pub color_type: lynx_color_type_e,
  pub width: u32,
  pub height: u32,
}

impl Default for lynx_accelerated_paint_info_t {
  fn default() -> Self {
    Self {
      struct_size: std::mem::size_of::<Self>(),
      shared_texture_handle: std::ptr::null_mut(),
      color_type: kLynxColorTypeRGBA_8888,
      width: 0,
      height: 0,
    }
  }
}

pub type lynx_windowless_ui_task_runner_runs_on_current_thread_callback =
  unsafe extern "C" fn(user_data: *mut c_void) -> bool;
pub type lynx_windowless_ui_task_runner_post_task_callback =
  unsafe extern "C" fn(task: lynx_task_t, target_time_nanos: u64, user_data: *mut c_void);

#[repr(C)]
#[derive(Copy, Clone)]
pub struct lynx_windowless_ui_task_runner_config_t {
  pub struct_size: usize,
  pub user_data: *mut c_void,
  pub runs_on_current_thread_callback:
    Option<lynx_windowless_ui_task_runner_runs_on_current_thread_callback>,
  pub post_task_callback: Option<lynx_windowless_ui_task_runner_post_task_callback>,
}

pub type napi_finalize = unsafe extern "C" fn(env: napi_env, data: *mut c_void, hint: *mut c_void);
pub type napi_module_creator = unsafe extern "C" fn(
  env: napi_env,
  exports: napi_value,
  module_name: *const c_char,
  opaque: *mut c_void,
) -> napi_value;
pub type extension_module_creator =
  unsafe extern "C" fn(opaque: *mut c_void) -> *mut lynx_extension_module_t;

pub type on_gl_make_current =
  unsafe extern "C" fn(renderer: *mut lynx_windowless_renderer_t) -> bool;
pub type on_gl_clear_current =
  unsafe extern "C" fn(renderer: *mut lynx_windowless_renderer_t) -> bool;
pub type on_gl_present = unsafe extern "C" fn(renderer: *mut lynx_windowless_renderer_t) -> bool;
pub type on_gl_create_fbo = unsafe extern "C" fn(
  renderer: *mut lynx_windowless_renderer_t,
  width: c_int,
  height: c_int,
) -> u32;
pub type on_gl_proc_resolver = unsafe extern "C" fn(
  renderer: *mut lynx_windowless_renderer_t,
  name: *const c_char,
) -> *mut c_void;
pub type on_software_present = unsafe extern "C" fn(
  renderer: *mut lynx_windowless_renderer_t,
  allocation: *const c_void,
  row_bytes: usize,
  height: usize,
) -> bool;
pub type on_accelerated_present =
  unsafe extern "C" fn(renderer: *mut lynx_windowless_renderer_t) -> bool;
pub type on_post_task = unsafe extern "C" fn(
  renderer: *mut lynx_windowless_renderer_t,
  task: lynx_task_t,
  interval_nanoseconds: u64,
);
pub type get_clipboard_data =
  unsafe extern "C" fn(renderer: *mut lynx_windowless_renderer_t) -> *const c_char;
pub type set_clipboard_data =
  unsafe extern "C" fn(renderer: *mut lynx_windowless_renderer_t, data: *const c_char);
pub type activate_system_cursor = unsafe extern "C" fn(
  renderer: *mut lynx_windowless_renderer_t,
  cursor_type: lynx_cursor_type_e,
  path: *const c_char,
);
pub type show_text_input =
  unsafe extern "C" fn(renderer: *mut lynx_windowless_renderer_t, show: bool);
pub type update_caret_position = unsafe extern "C" fn(
  renderer: *mut lynx_windowless_renderer_t,
  x: f32,
  y: f32,
  width: f32,
  height: f32,
);
pub type set_cursor_position =
  unsafe extern "C" fn(renderer: *mut lynx_windowless_renderer_t, position: c_int);
pub type set_marked_text_rect = unsafe extern "C" fn(
  renderer: *mut lynx_windowless_renderer_t,
  x: f32,
  y: f32,
  width: f32,
  height: f32,
);
pub type set_editable_transform =
  unsafe extern "C" fn(renderer: *mut lynx_windowless_renderer_t, transform_matrix: *const f32);

pub type fetch_resource_func = unsafe extern "C" fn(
  fetcher: *mut lynx_generic_resource_fetcher_t,
  request: *mut lynx_resource_request_t,
  response: *mut lynx_resource_response_t,
);
pub type cancel_fetch_func = unsafe extern "C" fn(
  fetcher: *mut lynx_generic_resource_fetcher_t,
  request_id: lynx_resource_request_id,
);

pub type lynx_windowless_renderer_finalizer =
  unsafe extern "C" fn(renderer: *mut lynx_windowless_renderer_t, user_data: *mut c_void);
pub type lynx_generic_resource_fetcher_finalizer =
  unsafe extern "C" fn(fetcher: *mut lynx_generic_resource_fetcher_t, user_data: *mut c_void);
pub type binary_data_dtor =
  unsafe extern "C" fn(content: *mut u8, length: usize, opaque: *mut c_void);
