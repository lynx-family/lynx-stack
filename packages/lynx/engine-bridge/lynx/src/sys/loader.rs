use super::bindings::*;
#[cfg(unix)]
use libloading::os::unix::{Library as UnixLibrary, RTLD_LOCAL, RTLD_NOW};
use libloading::Library;
use std::env;
use std::ffi::{c_char, c_int, c_void, OsString};
#[cfg(test)]
use std::mem;
use std::path::{Path, PathBuf};

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
  #[error("unsupported Lynx runtime loading target: {target}")]
  UnsupportedTarget { target: String },
  #[error("libLynx_clay was not found; set LYNX_LIB_PATH or LYNX_SDK_DIR")]
  NoLibraryCandidates,
  #[error("failed to open {}: {message}", path.display())]
  OpenLibrary { path: PathBuf, message: String },
  #[error("failed to load symbol {symbol} from {}: {message}", path.display())]
  MissingSymbol {
    path: PathBuf,
    symbol: &'static str,
    message: String,
  },
}

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
  candidate_library_paths_from(configured_lib_path(), configured_sdk_dir())
}

fn candidate_library_paths_from(
  configured_lib_path: Option<OsString>,
  configured_sdk_dir: Option<OsString>,
) -> Result<Vec<PathBuf>> {
  if let Some(path) = configured_lib_path {
    return Ok(vec![PathBuf::from(path)]);
  }
  if let Some(sdk_dir) = configured_sdk_dir {
    return Ok(vec![sdk_library_path(PathBuf::from(sdk_dir))?]);
  }
  Ok(Vec::new())
}

fn configured_lib_path() -> Option<OsString> {
  env::var_os("LYNX_LIB_PATH").or_else(|| option_env!("LYNX_LIB_PATH").map(OsString::from))
}

fn configured_sdk_dir() -> Option<OsString> {
  env::var_os("LYNX_SDK_DIR").or_else(|| option_env!("LYNX_SDK_DIR").map(OsString::from))
}

fn sdk_library_path(sdk_dir: PathBuf) -> Result<PathBuf> {
  Ok(sdk_dir.join("lib").join(library_filename()?))
}

struct DynamicLibrary {
  library: Library,
  path: PathBuf,
}

unsafe impl Send for DynamicLibrary {}
unsafe impl Sync for DynamicLibrary {}

impl DynamicLibrary {
  fn open(path: impl AsRef<Path>) -> Result<Self> {
    let path = path.as_ref().to_path_buf();
    let library = open_library(&path).map_err(|error| Error::OpenLibrary {
      path: path.clone(),
      message: error.to_string(),
    })?;
    Ok(Self { library, path })
  }

  unsafe fn symbol<T: Copy>(&self, symbol: &'static str) -> Result<T> {
    let symbol_value = unsafe { self.library.get::<T>(symbol.as_bytes()) }.map_err(|error| {
      Error::MissingSymbol {
        path: self.path.clone(),
        symbol,
        message: error.to_string(),
      }
    })?;
    Ok(*symbol_value)
  }
}

#[cfg(unix)]
fn open_library(path: &Path) -> std::result::Result<Library, libloading::Error> {
  unsafe { UnixLibrary::open(Some(path), RTLD_NOW | RTLD_LOCAL).map(Into::into) }
}

#[cfg(not(unix))]
fn open_library(path: &Path) -> std::result::Result<Library, libloading::Error> {
  unsafe { Library::new(path) }
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
  pub lynx_view_add_client: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_view_client_t),
  pub lynx_view_remove_client: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_view_client_t),
  pub lynx_view_load_template: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_load_meta_t),
  pub lynx_view_update_data: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_update_meta_t),
  pub lynx_view_reload_template:
    unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_template_data_t, *mut lynx_template_data_t),
  pub lynx_view_send_global_event:
    unsafe extern "C" fn(*mut lynx_view_t, *const c_char, *const c_char),
  pub lynx_rust_view_update_screen_metrics: unsafe extern "C" fn(*mut lynx_view_t, f32, f32, f32),
  pub lynx_rust_view_set_frame: unsafe extern "C" fn(*mut lynx_view_t, f32, f32, f32, f32),
  pub lynx_rust_view_set_font_scale: unsafe extern "C" fn(*mut lynx_view_t, f32),
  pub lynx_rust_view_set_use_texture_backend: unsafe extern "C" fn(*mut lynx_view_t, bool) -> bool,
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
  pub lynx_load_meta_set_template_bundle:
    unsafe extern "C" fn(*mut lynx_load_meta_t, *mut lynx_template_bundle_t),
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

  pub lynx_template_bundle_create: unsafe extern "C" fn(
    *mut u8,
    usize,
    Option<binary_data_dtor>,
    *mut c_void,
  ) -> *mut lynx_template_bundle_t,
  pub lynx_template_bundle_is_valid: unsafe extern "C" fn(*mut lynx_template_bundle_t) -> c_int,
  pub lynx_template_bundle_get_error_message:
    unsafe extern "C" fn(*mut lynx_template_bundle_t) -> *const c_char,
  pub lynx_template_bundle_release: unsafe extern "C" fn(*mut lynx_template_bundle_t),

  pub lynx_view_client_create: unsafe extern "C" fn(*mut c_void) -> *mut lynx_view_client_t,
  pub lynx_view_client_get_user_data: unsafe extern "C" fn(*mut lynx_view_client_t) -> *mut c_void,
  pub lynx_view_client_bind_on_page_start:
    unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_page_start>),
  pub lynx_view_client_bind_on_load_success:
    unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_load_success>),
  pub lynx_view_client_bind_on_first_screen:
    unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_first_screen>),
  pub lynx_view_client_bind_on_page_updated:
    unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_page_updated>),
  pub lynx_view_client_bind_on_data_updated:
    unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_data_updated>),
  pub lynx_view_client_bind_on_destroy:
    unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_destroy>),
  pub lynx_view_client_bind_on_runtime_ready:
    unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_runtime_ready>),
  pub lynx_view_client_bind_on_received_error:
    unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_received_error>),
  pub lynx_view_client_bind_on_timing_setup:
    unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_timing_setup>),
  pub lynx_view_client_bind_on_timing_update:
    unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_timing_update>),
  pub lynx_view_client_bind_on_enter_foreground:
    unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_enter_foreground>),
  pub lynx_view_client_bind_on_enter_background:
    unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_enter_background>),
  pub lynx_view_client_bind_on_frame_timing:
    unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_frame_timing>),
  pub lynx_view_client_release: unsafe extern "C" fn(*mut lynx_view_client_t),

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
      lynx_rust_view_builder_set_screen_size: load_symbol!(
        library,
        lynx_rust_view_builder_set_screen_size
      ),
      lynx_rust_view_builder_set_frame: load_symbol!(library, lynx_rust_view_builder_set_frame),
      lynx_rust_view_builder_set_font_scale: load_symbol!(
        library,
        lynx_rust_view_builder_set_font_scale
      ),
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
      lynx_view_add_client: load_symbol!(library, lynx_view_add_client),
      lynx_view_remove_client: load_symbol!(library, lynx_view_remove_client),
      lynx_view_load_template: load_symbol!(library, lynx_view_load_template),
      lynx_view_update_data: load_symbol!(library, lynx_view_update_data),
      lynx_view_reload_template: load_symbol!(library, lynx_view_reload_template),
      lynx_view_send_global_event: load_symbol!(library, lynx_view_send_global_event),
      lynx_rust_view_update_screen_metrics: load_symbol!(
        library,
        lynx_rust_view_update_screen_metrics
      ),
      lynx_rust_view_set_frame: load_symbol!(library, lynx_rust_view_set_frame),
      lynx_rust_view_set_font_scale: load_symbol!(library, lynx_rust_view_set_font_scale),
      lynx_rust_view_set_use_texture_backend: load_symbol!(
        library,
        lynx_rust_view_set_use_texture_backend
      ),
      lynx_view_enter_foreground: load_symbol!(library, lynx_view_enter_foreground),
      lynx_view_enter_background: load_symbol!(library, lynx_view_enter_background),

      lynx_load_meta_create: load_symbol!(library, lynx_load_meta_create),
      lynx_load_meta_set_url: load_symbol!(library, lynx_load_meta_set_url),
      lynx_load_meta_set_binary_data: load_symbol!(library, lynx_load_meta_set_binary_data),
      lynx_load_meta_set_template_bundle: load_symbol!(library, lynx_load_meta_set_template_bundle),
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

      lynx_template_bundle_create: load_symbol!(library, lynx_template_bundle_create),
      lynx_template_bundle_is_valid: load_symbol!(library, lynx_template_bundle_is_valid),
      lynx_template_bundle_get_error_message: load_symbol!(
        library,
        lynx_template_bundle_get_error_message
      ),
      lynx_template_bundle_release: load_symbol!(library, lynx_template_bundle_release),

      lynx_view_client_create: load_symbol!(library, lynx_view_client_create),
      lynx_view_client_get_user_data: load_symbol!(library, lynx_view_client_get_user_data),
      lynx_view_client_bind_on_page_start: load_symbol!(
        library,
        lynx_view_client_bind_on_page_start
      ),
      lynx_view_client_bind_on_load_success: load_symbol!(
        library,
        lynx_view_client_bind_on_load_success
      ),
      lynx_view_client_bind_on_first_screen: load_symbol!(
        library,
        lynx_view_client_bind_on_first_screen
      ),
      lynx_view_client_bind_on_page_updated: load_symbol!(
        library,
        lynx_view_client_bind_on_page_updated
      ),
      lynx_view_client_bind_on_data_updated: load_symbol!(
        library,
        lynx_view_client_bind_on_data_updated
      ),
      lynx_view_client_bind_on_destroy: load_symbol!(library, lynx_view_client_bind_on_destroy),
      lynx_view_client_bind_on_runtime_ready: load_symbol!(
        library,
        lynx_view_client_bind_on_runtime_ready
      ),
      lynx_view_client_bind_on_received_error: load_symbol!(
        library,
        lynx_view_client_bind_on_received_error
      ),
      lynx_view_client_bind_on_timing_setup: load_symbol!(
        library,
        lynx_view_client_bind_on_timing_setup
      ),
      lynx_view_client_bind_on_timing_update: load_symbol!(
        library,
        lynx_view_client_bind_on_timing_update
      ),
      lynx_view_client_bind_on_enter_foreground: load_symbol!(
        library,
        lynx_view_client_bind_on_enter_foreground
      ),
      lynx_view_client_bind_on_enter_background: load_symbol!(
        library,
        lynx_view_client_bind_on_enter_background
      ),
      lynx_view_client_bind_on_frame_timing: load_symbol!(
        library,
        lynx_view_client_bind_on_frame_timing
      ),
      lynx_view_client_release: load_symbol!(library, lynx_view_client_release),

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
  fn sdk_library_path_uses_single_canonical_lib_directory() {
    let path = sdk_library_path(PathBuf::from("/tmp/lynx-sdk")).unwrap();
    if cfg!(target_os = "macos") {
      assert_eq!(path, PathBuf::from("/tmp/lynx-sdk/lib/libLynx_clay.dylib"));
    }
    if cfg!(target_os = "linux") {
      assert_eq!(path, PathBuf::from("/tmp/lynx-sdk/lib/libLynx_clay.so"));
    }
  }

  #[test]
  fn explicit_library_path_wins_over_sdk_dir() {
    let paths = candidate_library_paths_from(
      Some(OsString::from("/tmp/custom/libLynx_clay.dylib")),
      Some(OsString::from("/tmp/lynx-sdk")),
    )
    .unwrap();
    assert_eq!(paths, vec![PathBuf::from("/tmp/custom/libLynx_clay.dylib")]);
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
