use super::bindings::*;
use std::env;
use std::ffi::{c_char, c_int, c_void, CStr, CString};
use std::fmt;
use std::mem;
use std::path::{Path, PathBuf};
use std::ptr::NonNull;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug)]
pub enum Error {
  UnsupportedTarget {
    target: String,
  },
  NoLibraryCandidates,
  InvalidLibraryPath {
    path: PathBuf,
  },
  OpenLibrary {
    path: PathBuf,
    message: String,
  },
  MissingSymbol {
    path: PathBuf,
    symbol: &'static str,
    message: String,
  },
}

impl fmt::Display for Error {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      Error::UnsupportedTarget { target } => {
        write!(f, "unsupported Lynx runtime loading target: {target}")
      }
      Error::NoLibraryCandidates => write!(
        f,
        "libLynx_clay was not found; set LYNX_LIB_PATH or LYNX_SDK_DIR"
      ),
      Error::InvalidLibraryPath { path } => {
        write!(
          f,
          "library path contains an interior NUL: {}",
          path.display()
        )
      }
      Error::OpenLibrary { path, message } => {
        write!(f, "failed to open {}: {message}", path.display())
      }
      Error::MissingSymbol {
        path,
        symbol,
        message,
      } => write!(
        f,
        "failed to load symbol {symbol} from {}: {message}",
        path.display()
      ),
    }
  }
}

impl std::error::Error for Error {}

pub fn library_filename() -> Result<&'static str> {
  if cfg!(target_os = "macos") {
    Ok("libLynx_clay.dylib")
  } else if cfg!(target_os = "linux") {
    Ok("libLynx_clay.so")
  } else {
    Err(Error::UnsupportedTarget {
      target: env::var("TARGET").unwrap_or_else(|_| env::consts::OS.to_string()),
    })
  }
}

pub fn candidate_library_paths() -> Result<Vec<PathBuf>> {
  let mut candidates = Vec::new();
  if let Some(path) = env::var_os("LYNX_LIB_PATH") {
    push_unique_path(&mut candidates, PathBuf::from(path));
  }
  if let Some(sdk_dir) = env::var_os("LYNX_SDK_DIR") {
    let sdk_dir = PathBuf::from(sdk_dir);
    push_unique_path(
      &mut candidates,
      sdk_dir.join("lib").join(library_filename()?),
    );
    push_unique_path(&mut candidates, sdk_dir.join(library_filename()?));
  }
  Ok(candidates)
}

fn push_unique_path(candidates: &mut Vec<PathBuf>, path: PathBuf) {
  if !candidates.iter().any(|candidate| candidate == &path) {
    candidates.push(path);
  }
}

struct DynamicLibrary {
  handle: NonNull<c_void>,
  path: PathBuf,
}

unsafe impl Send for DynamicLibrary {}
unsafe impl Sync for DynamicLibrary {}

impl DynamicLibrary {
  fn open(path: impl AsRef<Path>) -> Result<Self> {
    let path = path.as_ref().to_path_buf();
    let c_path = CString::new(path.to_string_lossy().as_bytes())
      .map_err(|_| Error::InvalidLibraryPath { path: path.clone() })?;
    let handle = unsafe { dlopen(c_path.as_ptr(), RTLD_NOW | RTLD_LOCAL) };
    let handle = NonNull::new(handle).ok_or_else(|| Error::OpenLibrary {
      path: path.clone(),
      message: last_dl_error(),
    })?;
    Ok(Self { handle, path })
  }

  unsafe fn symbol<T: Copy>(&self, symbol: &'static str) -> Result<T> {
    let c_symbol = CString::new(symbol).expect("symbol names are static and NUL-free");
    let ptr = dlsym(self.handle.as_ptr(), c_symbol.as_ptr());
    if ptr.is_null() {
      return Err(Error::MissingSymbol {
        path: self.path.clone(),
        symbol,
        message: last_dl_error(),
      });
    }
    Ok(mem::transmute_copy::<*mut c_void, T>(&ptr))
  }
}

impl Drop for DynamicLibrary {
  fn drop(&mut self) {
    unsafe {
      dlclose(self.handle.as_ptr());
    }
  }
}

#[allow(non_camel_case_types)]
pub struct LoadedLibrary {
  _library: DynamicLibrary,
  pub path: PathBuf,

  pub lynx_env_get_sdk_version: unsafe extern "C" fn() -> *const c_char,
  pub lynx_env_set_icu_data_path: unsafe extern "C" fn(*const c_char),
  pub lynx_env_get_icu_data_path: unsafe extern "C" fn() -> *const c_char,
  pub lynx_env_enable_devtool: unsafe extern "C" fn(c_int),
  pub lynx_env_is_devtool_enabled: unsafe extern "C" fn() -> c_int,
  pub lynx_env_enable_logbox: unsafe extern "C" fn(c_int),
  pub lynx_env_is_logbox_enabled: unsafe extern "C" fn() -> c_int,
  pub lynx_env_register_native_module:
    unsafe extern "C" fn(*const c_char, Option<napi_module_creator>, *mut c_void),
  pub lynx_env_register_extension_module:
    unsafe extern "C" fn(*const c_char, Option<extension_module_creator>, bool, *mut c_void),

  pub lynx_group_create: unsafe extern "C" fn(*const c_char) -> *mut lynx_group_t,
  pub lynx_group_create_with_id:
    unsafe extern "C" fn(*const c_char, *const c_char) -> *mut lynx_group_t,
  pub lynx_group_set_preload_js_paths:
    unsafe extern "C" fn(*mut lynx_group_t, *const *const c_char, usize),
  pub lynx_group_set_enable_js_group_thread: unsafe extern "C" fn(*mut lynx_group_t, c_int),
  pub lynx_group_release: unsafe extern "C" fn(*mut lynx_group_t),

  pub lynx_view_builder_create: unsafe extern "C" fn() -> *mut lynx_view_builder_t,
  pub lynx_rust_view_builder_set_screen_size:
    unsafe extern "C" fn(*mut lynx_view_builder_t, f32, f32, f32),
  pub lynx_rust_view_builder_set_frame:
    unsafe extern "C" fn(*mut lynx_view_builder_t, f32, f32, f32, f32),
  pub lynx_rust_view_builder_set_font_scale: unsafe extern "C" fn(*mut lynx_view_builder_t, f32),
  pub lynx_view_builder_set_icu_data_path:
    unsafe extern "C" fn(*mut lynx_view_builder_t, *const c_char),
  pub lynx_view_builder_set_lynx_group:
    unsafe extern "C" fn(*mut lynx_view_builder_t, *mut lynx_group_t),
  pub lynx_view_builder_set_windowless_renderer:
    unsafe extern "C" fn(*mut lynx_view_builder_t, *mut lynx_windowless_renderer_t),
  pub lynx_view_builder_set_generic_resource_fetcher:
    unsafe extern "C" fn(*mut lynx_view_builder_t, *mut lynx_generic_resource_fetcher_t),
  pub lynx_view_builder_register_native_module: unsafe extern "C" fn(
    *mut lynx_view_builder_t,
    *const c_char,
    Option<napi_module_creator>,
    *mut c_void,
  ),
  pub lynx_view_builder_register_extension_module: unsafe extern "C" fn(
    *mut lynx_view_builder_t,
    *const c_char,
    Option<extension_module_creator>,
    bool,
    *mut c_void,
  ),
  pub lynx_view_builder_release: unsafe extern "C" fn(*mut lynx_view_builder_t),

  pub lynx_view_create:
    unsafe extern "C" fn(*mut lynx_view_builder_t, *mut c_void) -> *mut lynx_view_t,
  pub lynx_view_release: unsafe extern "C" fn(*mut lynx_view_t),
  pub lynx_view_load_template: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_load_meta_t),
  pub lynx_view_update_data: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_update_meta_t),
  pub lynx_view_reload_template:
    unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_template_data_t, *mut lynx_template_data_t),
  pub lynx_view_send_global_event:
    unsafe extern "C" fn(*mut lynx_view_t, *const c_char, *const c_char),
  pub lynx_rust_view_update_screen_metrics: unsafe extern "C" fn(*mut lynx_view_t, f32, f32, f32),
  pub lynx_rust_view_set_frame: unsafe extern "C" fn(*mut lynx_view_t, f32, f32, f32, f32),
  pub lynx_rust_view_set_font_scale: unsafe extern "C" fn(*mut lynx_view_t, f32),
  pub lynx_view_enter_foreground: unsafe extern "C" fn(*mut lynx_view_t),
  pub lynx_view_enter_background: unsafe extern "C" fn(*mut lynx_view_t),

  pub lynx_load_meta_create: unsafe extern "C" fn() -> *mut lynx_load_meta_t,
  pub lynx_load_meta_set_url: unsafe extern "C" fn(*mut lynx_load_meta_t, *const c_char),
  pub lynx_load_meta_set_binary_data: unsafe extern "C" fn(
    *mut lynx_load_meta_t,
    *mut u8,
    usize,
    Option<binary_data_dtor>,
    *mut c_void,
  ),
  pub lynx_load_meta_set_initial_data:
    unsafe extern "C" fn(*mut lynx_load_meta_t, *mut lynx_template_data_t),
  pub lynx_load_meta_set_global_props:
    unsafe extern "C" fn(*mut lynx_load_meta_t, *mut lynx_template_data_t),
  pub lynx_load_meta_release: unsafe extern "C" fn(*mut lynx_load_meta_t),

  pub lynx_update_meta_create: unsafe extern "C" fn() -> *mut lynx_update_meta_t,
  pub lynx_update_meta_set_update_data:
    unsafe extern "C" fn(*mut lynx_update_meta_t, *mut lynx_template_data_t),
  pub lynx_update_meta_set_global_props:
    unsafe extern "C" fn(*mut lynx_update_meta_t, *mut lynx_template_data_t),
  pub lynx_update_meta_release: unsafe extern "C" fn(*mut lynx_update_meta_t),

  pub lynx_template_data_create_from_json:
    unsafe extern "C" fn(*const c_char) -> *mut lynx_template_data_t,
  pub lynx_template_data_mark_state: unsafe extern "C" fn(*mut lynx_template_data_t, *const c_char),
  pub lynx_template_data_set_read_only: unsafe extern "C" fn(*mut lynx_template_data_t, c_int),
  pub lynx_template_data_release: unsafe extern "C" fn(*mut lynx_template_data_t),

  pub lynx_generic_resource_fetcher_create_with_finalizer:
    unsafe extern "C" fn(
      *mut c_void,
      Option<lynx_generic_resource_fetcher_finalizer>,
    ) -> *mut lynx_generic_resource_fetcher_t,
  pub lynx_generic_resource_fetcher_bind_fetch_resource:
    unsafe extern "C" fn(*mut lynx_generic_resource_fetcher_t, Option<fetch_resource_func>),
  pub lynx_generic_resource_fetcher_bind_fetch_resource_path:
    unsafe extern "C" fn(*mut lynx_generic_resource_fetcher_t, Option<fetch_resource_func>),
  pub lynx_generic_resource_fetcher_bind_cancel_fetch:
    unsafe extern "C" fn(*mut lynx_generic_resource_fetcher_t, Option<cancel_fetch_func>),
  pub lynx_generic_resource_fetcher_release:
    unsafe extern "C" fn(*mut lynx_generic_resource_fetcher_t),
  pub lynx_resource_request_get_id:
    unsafe extern "C" fn(*mut lynx_resource_request_t) -> lynx_resource_request_id,
  pub lynx_resource_request_get_type:
    unsafe extern "C" fn(*mut lynx_resource_request_t) -> lynx_resource_type_e,
  pub lynx_resource_request_get_url:
    unsafe extern "C" fn(*mut lynx_resource_request_t) -> *const c_char,
  pub lynx_resource_request_release: unsafe extern "C" fn(*mut lynx_resource_request_t),
  pub lynx_resource_response_set_code: unsafe extern "C" fn(*mut lynx_resource_response_t, c_int),
  pub lynx_resource_response_set_error_message:
    unsafe extern "C" fn(*mut lynx_resource_response_t, *const c_char),
  pub lynx_resource_response_set_data: unsafe extern "C" fn(
    *mut lynx_resource_response_t,
    *mut u8,
    usize,
    Option<binary_data_dtor>,
    *mut c_void,
  ),
  pub lynx_resource_response_callback: unsafe extern "C" fn(*mut lynx_resource_response_t),
  pub lynx_resource_response_release: unsafe extern "C" fn(*mut lynx_resource_response_t),

  pub lynx_windowless_set_global_ui_task_runner:
    unsafe extern "C" fn(*const lynx_windowless_ui_task_runner_config_t) -> bool,
  pub lynx_windowless_run_ui_task: unsafe extern "C" fn(lynx_task_t) -> bool,
  pub lynx_windowless_renderer_create_with_finalizer:
    unsafe extern "C" fn(
      lynx_windowless_renderer_type_e,
      *mut c_void,
      Option<lynx_windowless_renderer_finalizer>,
    ) -> *mut lynx_windowless_renderer_t,
  pub lynx_windowless_renderer_bind_on_gl_make_current:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_gl_make_current>),
  pub lynx_windowless_renderer_bind_on_gl_clear_current:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_gl_clear_current>),
  pub lynx_windowless_renderer_bind_on_gl_present:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_gl_present>),
  pub lynx_windowless_renderer_bind_on_gl_create_fbo:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_gl_create_fbo>),
  pub lynx_windowless_renderer_bind_on_gl_proc_resolver:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_gl_proc_resolver>),
  pub lynx_windowless_renderer_bind_on_software_present:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_software_present>),
  pub lynx_windowless_renderer_bind_on_accelerated_present:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_accelerated_present>),
  pub lynx_windowless_renderer_get_accelerated_paint_info: unsafe extern "C" fn(
    *mut lynx_windowless_renderer_t,
    *mut lynx_accelerated_paint_info_t,
  ) -> bool,
  pub lynx_windowless_renderer_bind_on_post_task:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_post_task>),
  pub lynx_windowless_renderer_run_task:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, lynx_task_t),
  pub lynx_windowless_renderer_send_pointer_event:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, *mut lynx_pointer_event_t),
  pub lynx_windowless_renderer_send_key_event:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, *mut lynx_key_event_t),
  pub lynx_windowless_renderer_bind_get_clipboard_data:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<get_clipboard_data>),
  pub lynx_windowless_renderer_bind_set_clipboard_data:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<set_clipboard_data>),
  pub lynx_windowless_renderer_bind_activate_system_cursor:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<activate_system_cursor>),
  pub lynx_windowless_renderer_bind_show_text_input:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<show_text_input>),
  pub lynx_windowless_renderer_bind_update_caret_position:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<update_caret_position>),
  pub lynx_windowless_renderer_bind_set_cursor_position:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<set_cursor_position>),
  pub lynx_windowless_renderer_bind_set_marked_text_rect:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<set_marked_text_rect>),
  pub lynx_windowless_renderer_bind_set_editable_transform:
    unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<set_editable_transform>),
  pub lynx_windowless_renderer_release: unsafe extern "C" fn(*mut lynx_windowless_renderer_t),
}

unsafe impl Send for LoadedLibrary {}
unsafe impl Sync for LoadedLibrary {}

macro_rules! load_symbol {
  ($library:expr, $name:ident) => {
    unsafe { $library.symbol(stringify!($name))? }
  };
}

impl LoadedLibrary {
  pub fn load_from_environment() -> Result<Self> {
    let candidates = candidate_library_paths()?;
    if candidates.is_empty() {
      return Err(Error::NoLibraryCandidates);
    }

    let mut last_error = None;
    for candidate in candidates {
      match Self::load(candidate.clone()) {
        Ok(library) => return Ok(library),
        Err(error) => last_error = Some(error),
      }
    }
    Err(last_error.unwrap_or(Error::NoLibraryCandidates))
  }

  pub fn load(path: impl AsRef<Path>) -> Result<Self> {
    let library = DynamicLibrary::open(path)?;
    Self::from_dynamic_library(library)
  }

  fn from_dynamic_library(library: DynamicLibrary) -> Result<Self> {
    let path = library.path.clone();
    let (
      lynx_rust_view_builder_set_screen_size,
      lynx_rust_view_builder_set_frame,
      lynx_rust_view_builder_set_font_scale,
      lynx_rust_view_update_screen_metrics,
      lynx_rust_view_set_frame,
      lynx_rust_view_set_font_scale,
    ) = {
      (
        load_symbol!(library, lynx_rust_view_builder_set_screen_size),
        load_symbol!(library, lynx_rust_view_builder_set_frame),
        load_symbol!(library, lynx_rust_view_builder_set_font_scale),
        load_symbol!(library, lynx_rust_view_update_screen_metrics),
        load_symbol!(library, lynx_rust_view_set_frame),
        load_symbol!(library, lynx_rust_view_set_font_scale),
      )
    };
    Ok(Self {
      lynx_env_get_sdk_version: load_symbol!(library, lynx_env_get_sdk_version),
      lynx_env_set_icu_data_path: load_symbol!(library, lynx_env_set_icu_data_path),
      lynx_env_get_icu_data_path: load_symbol!(library, lynx_env_get_icu_data_path),
      lynx_env_enable_devtool: load_symbol!(library, lynx_env_enable_devtool),
      lynx_env_is_devtool_enabled: load_symbol!(library, lynx_env_is_devtool_enabled),
      lynx_env_enable_logbox: load_symbol!(library, lynx_env_enable_logbox),
      lynx_env_is_logbox_enabled: load_symbol!(library, lynx_env_is_logbox_enabled),
      lynx_env_register_native_module: load_symbol!(library, lynx_env_register_native_module),
      lynx_env_register_extension_module: load_symbol!(library, lynx_env_register_extension_module),

      lynx_group_create: load_symbol!(library, lynx_group_create),
      lynx_group_create_with_id: load_symbol!(library, lynx_group_create_with_id),
      lynx_group_set_preload_js_paths: load_symbol!(library, lynx_group_set_preload_js_paths),
      lynx_group_set_enable_js_group_thread: load_symbol!(
        library,
        lynx_group_set_enable_js_group_thread
      ),
      lynx_group_release: load_symbol!(library, lynx_group_release),

      lynx_view_builder_create: load_symbol!(library, lynx_view_builder_create),
      lynx_rust_view_builder_set_screen_size,
      lynx_rust_view_builder_set_frame,
      lynx_rust_view_builder_set_font_scale,
      lynx_view_builder_set_icu_data_path: load_symbol!(
        library,
        lynx_view_builder_set_icu_data_path
      ),
      lynx_view_builder_set_lynx_group: load_symbol!(library, lynx_view_builder_set_lynx_group),
      lynx_view_builder_set_windowless_renderer: load_symbol!(
        library,
        lynx_view_builder_set_windowless_renderer
      ),
      lynx_view_builder_set_generic_resource_fetcher: load_symbol!(
        library,
        lynx_view_builder_set_generic_resource_fetcher
      ),
      lynx_view_builder_register_native_module: load_symbol!(
        library,
        lynx_view_builder_register_native_module
      ),
      lynx_view_builder_register_extension_module: load_symbol!(
        library,
        lynx_view_builder_register_extension_module
      ),
      lynx_view_builder_release: load_symbol!(library, lynx_view_builder_release),

      lynx_view_create: load_symbol!(library, lynx_view_create),
      lynx_view_release: load_symbol!(library, lynx_view_release),
      lynx_view_load_template: load_symbol!(library, lynx_view_load_template),
      lynx_view_update_data: load_symbol!(library, lynx_view_update_data),
      lynx_view_reload_template: load_symbol!(library, lynx_view_reload_template),
      lynx_view_send_global_event: load_symbol!(library, lynx_view_send_global_event),
      lynx_rust_view_update_screen_metrics,
      lynx_rust_view_set_frame,
      lynx_rust_view_set_font_scale,
      lynx_view_enter_foreground: load_symbol!(library, lynx_view_enter_foreground),
      lynx_view_enter_background: load_symbol!(library, lynx_view_enter_background),

      lynx_load_meta_create: load_symbol!(library, lynx_load_meta_create),
      lynx_load_meta_set_url: load_symbol!(library, lynx_load_meta_set_url),
      lynx_load_meta_set_binary_data: load_symbol!(library, lynx_load_meta_set_binary_data),
      lynx_load_meta_set_initial_data: load_symbol!(library, lynx_load_meta_set_initial_data),
      lynx_load_meta_set_global_props: load_symbol!(library, lynx_load_meta_set_global_props),
      lynx_load_meta_release: load_symbol!(library, lynx_load_meta_release),

      lynx_update_meta_create: load_symbol!(library, lynx_update_meta_create),
      lynx_update_meta_set_update_data: load_symbol!(library, lynx_update_meta_set_update_data),
      lynx_update_meta_set_global_props: load_symbol!(library, lynx_update_meta_set_global_props),
      lynx_update_meta_release: load_symbol!(library, lynx_update_meta_release),

      lynx_template_data_create_from_json: load_symbol!(
        library,
        lynx_template_data_create_from_json
      ),
      lynx_template_data_mark_state: load_symbol!(library, lynx_template_data_mark_state),
      lynx_template_data_set_read_only: load_symbol!(library, lynx_template_data_set_read_only),
      lynx_template_data_release: load_symbol!(library, lynx_template_data_release),

      lynx_generic_resource_fetcher_create_with_finalizer: load_symbol!(
        library,
        lynx_generic_resource_fetcher_create_with_finalizer
      ),
      lynx_generic_resource_fetcher_bind_fetch_resource: load_symbol!(
        library,
        lynx_generic_resource_fetcher_bind_fetch_resource
      ),
      lynx_generic_resource_fetcher_bind_fetch_resource_path: load_symbol!(
        library,
        lynx_generic_resource_fetcher_bind_fetch_resource_path
      ),
      lynx_generic_resource_fetcher_bind_cancel_fetch: load_symbol!(
        library,
        lynx_generic_resource_fetcher_bind_cancel_fetch
      ),
      lynx_generic_resource_fetcher_release: load_symbol!(
        library,
        lynx_generic_resource_fetcher_release
      ),
      lynx_resource_request_get_id: load_symbol!(library, lynx_resource_request_get_id),
      lynx_resource_request_get_type: load_symbol!(library, lynx_resource_request_get_type),
      lynx_resource_request_get_url: load_symbol!(library, lynx_resource_request_get_url),
      lynx_resource_request_release: load_symbol!(library, lynx_resource_request_release),
      lynx_resource_response_set_code: load_symbol!(library, lynx_resource_response_set_code),
      lynx_resource_response_set_error_message: load_symbol!(
        library,
        lynx_resource_response_set_error_message
      ),
      lynx_resource_response_set_data: load_symbol!(library, lynx_resource_response_set_data),
      lynx_resource_response_callback: load_symbol!(library, lynx_resource_response_callback),
      lynx_resource_response_release: load_symbol!(library, lynx_resource_response_release),

      lynx_windowless_set_global_ui_task_runner: load_symbol!(
        library,
        lynx_windowless_set_global_ui_task_runner
      ),
      lynx_windowless_run_ui_task: load_symbol!(library, lynx_windowless_run_ui_task),
      lynx_windowless_renderer_create_with_finalizer: load_symbol!(
        library,
        lynx_windowless_renderer_create_with_finalizer
      ),
      lynx_windowless_renderer_bind_on_gl_make_current: load_symbol!(
        library,
        lynx_windowless_renderer_bind_on_gl_make_current
      ),
      lynx_windowless_renderer_bind_on_gl_clear_current: load_symbol!(
        library,
        lynx_windowless_renderer_bind_on_gl_clear_current
      ),
      lynx_windowless_renderer_bind_on_gl_present: load_symbol!(
        library,
        lynx_windowless_renderer_bind_on_gl_present
      ),
      lynx_windowless_renderer_bind_on_gl_create_fbo: load_symbol!(
        library,
        lynx_windowless_renderer_bind_on_gl_create_fbo
      ),
      lynx_windowless_renderer_bind_on_gl_proc_resolver: load_symbol!(
        library,
        lynx_windowless_renderer_bind_on_gl_proc_resolver
      ),
      lynx_windowless_renderer_bind_on_software_present: load_symbol!(
        library,
        lynx_windowless_renderer_bind_on_software_present
      ),
      lynx_windowless_renderer_bind_on_accelerated_present: load_symbol!(
        library,
        lynx_windowless_renderer_bind_on_accelerated_present
      ),
      lynx_windowless_renderer_get_accelerated_paint_info: load_symbol!(
        library,
        lynx_windowless_renderer_get_accelerated_paint_info
      ),
      lynx_windowless_renderer_bind_on_post_task: load_symbol!(
        library,
        lynx_windowless_renderer_bind_on_post_task
      ),
      lynx_windowless_renderer_run_task: load_symbol!(library, lynx_windowless_renderer_run_task),
      lynx_windowless_renderer_send_pointer_event: load_symbol!(
        library,
        lynx_windowless_renderer_send_pointer_event
      ),
      lynx_windowless_renderer_send_key_event: load_symbol!(
        library,
        lynx_windowless_renderer_send_key_event
      ),
      lynx_windowless_renderer_bind_get_clipboard_data: load_symbol!(
        library,
        lynx_windowless_renderer_bind_get_clipboard_data
      ),
      lynx_windowless_renderer_bind_set_clipboard_data: load_symbol!(
        library,
        lynx_windowless_renderer_bind_set_clipboard_data
      ),
      lynx_windowless_renderer_bind_activate_system_cursor: load_symbol!(
        library,
        lynx_windowless_renderer_bind_activate_system_cursor
      ),
      lynx_windowless_renderer_bind_show_text_input: load_symbol!(
        library,
        lynx_windowless_renderer_bind_show_text_input
      ),
      lynx_windowless_renderer_bind_update_caret_position: load_symbol!(
        library,
        lynx_windowless_renderer_bind_update_caret_position
      ),
      lynx_windowless_renderer_bind_set_cursor_position: load_symbol!(
        library,
        lynx_windowless_renderer_bind_set_cursor_position
      ),
      lynx_windowless_renderer_bind_set_marked_text_rect: load_symbol!(
        library,
        lynx_windowless_renderer_bind_set_marked_text_rect
      ),
      lynx_windowless_renderer_bind_set_editable_transform: load_symbol!(
        library,
        lynx_windowless_renderer_bind_set_editable_transform
      ),
      lynx_windowless_renderer_release: load_symbol!(library, lynx_windowless_renderer_release),
      path,
      _library: library,
    })
  }
}

fn last_dl_error() -> String {
  unsafe {
    let error = dlerror();
    if error.is_null() {
      "unknown dynamic loader error".to_string()
    } else {
      CStr::from_ptr(error).to_string_lossy().into_owned()
    }
  }
}

const RTLD_LOCAL: c_int = 0;
const RTLD_NOW: c_int = 2;

#[cfg(any(target_os = "macos", target_os = "linux"))]
extern "C" {
  fn dlopen(filename: *const c_char, flags: c_int) -> *mut c_void;
  fn dlsym(handle: *mut c_void, symbol: *const c_char) -> *mut c_void;
  fn dlclose(handle: *mut c_void) -> c_int;
  fn dlerror() -> *const c_char;
}

#[cfg(target_os = "linux")]
#[link(name = "dl")]
extern "C" {}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn value_layout_matches_c_header_contract() {
    assert_eq!(mem::size_of::<lynx_value>(), 16);
    assert_eq!(mem::align_of::<lynx_value>(), 8);
  }

  #[test]
  fn library_filename_matches_target() {
    let filename = library_filename().unwrap();
    if cfg!(target_os = "macos") {
      assert_eq!(filename, "libLynx_clay.dylib");
    }
    if cfg!(target_os = "linux") {
      assert_eq!(filename, "libLynx_clay.so");
    }
  }

  #[test]
  fn explicit_missing_library_path_reports_open_error() {
    let err = match LoadedLibrary::load("/definitely/missing/libLynx_clay.dylib") {
      Ok(_) => panic!("missing library unexpectedly loaded"),
      Err(err) => err,
    };
    assert!(matches!(err, Error::OpenLibrary { .. }));
  }
}
