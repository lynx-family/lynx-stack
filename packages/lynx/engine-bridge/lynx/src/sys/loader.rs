use super::bindings::*;
#[cfg(unix)]
use libloading::os::unix::{Library as UnixLibrary, RTLD_LOCAL, RTLD_NOW};
use libloading::Library;
use std::env;
use std::ffi::{c_char, c_int, c_void, OsString};
use std::path::{Path, PathBuf};
#[cfg(test)]
use std::{collections::HashSet, mem};

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

  unsafe fn optional_symbol<T: Copy>(&self, symbol: &'static str) -> Option<T> {
    unsafe { self.library.get::<T>(symbol.as_bytes()) }
      .ok()
      .map(|symbol_value| *symbol_value)
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

#[cfg(test)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum LoadedSymbolRequirement {
  Required,
  Optional,
}

#[cfg(test)]
#[derive(Clone, Copy, Debug)]
struct LoadedSymbolSpec {
  header: &'static str,
  name: &'static str,
  requirement: LoadedSymbolRequirement,
}

// Keep every dynamically loaded LYNX_CAPI_EXPORT function in this single
// manifest. Grouping by its public/capi header makes ABI reviews local, while
// generating both the struct fields and their resolvers prevents the two lists
// from drifting.
macro_rules! define_loaded_library {
  (
    $(
      header $header:literal {
        required {
          $($required_name:ident: $required_type:ty;)*
        }
        optional {
          $($optional_name:ident: $optional_type:ty;)*
        }
      }
    )*
  ) => {
    #[allow(non_camel_case_types)]
    pub struct LoadedLibrary {
      _library: DynamicLibrary,
      pub path: PathBuf,
      $(
        $(pub $required_name: $required_type,)*
        $(pub $optional_name: Option<$optional_type>,)*
      )*
    }

    unsafe impl Send for LoadedLibrary {}
    unsafe impl Sync for LoadedLibrary {}

    impl LoadedLibrary {
      fn from_dynamic_library(library: DynamicLibrary) -> Result<Self> {
        let path = library.path.clone();
        Ok(Self {
          $(
            $(
              $required_name: unsafe {
                library.symbol::<$required_type>(stringify!($required_name))?
              },
            )*
            $(
              $optional_name: unsafe {
                library.optional_symbol::<$optional_type>(stringify!($optional_name))
              },
            )*
          )*
          path,
          _library: library,
        })
      }
    }

    #[cfg(test)]
    const LOADED_LIBRARY_SYMBOLS: &[LoadedSymbolSpec] = &[
      $(
        $(
          LoadedSymbolSpec {
            header: $header,
            name: stringify!($required_name),
            requirement: LoadedSymbolRequirement::Required,
          },
        )*
        $(
          LoadedSymbolSpec {
            header: $header,
            name: stringify!($optional_name),
            requirement: LoadedSymbolRequirement::Optional,
          },
        )*
      )*
    ];
  };
}

define_loaded_library! {
  header "lynx_env_capi.h" {
    required {
      lynx_env_get_sdk_version: unsafe extern "C" fn() -> *const c_char;
      lynx_env_set_icu_data_path: unsafe extern "C" fn(*const c_char);
      lynx_env_get_icu_data_path: unsafe extern "C" fn() -> *const c_char;
      lynx_env_set_devtool_app_info: unsafe extern "C" fn(*const c_char, *const c_char);
      lynx_env_enable_devtool: unsafe extern "C" fn(c_int);
      lynx_env_is_devtool_enabled: unsafe extern "C" fn() -> c_int;
      lynx_env_connect_devtool: unsafe extern "C" fn(*const c_char) -> c_int;
      lynx_env_enable_logbox: unsafe extern "C" fn(c_int);
      lynx_env_is_logbox_enabled: unsafe extern "C" fn() -> c_int;
      lynx_env_register_native_module:
        unsafe extern "C" fn(*const c_char, Option<napi_module_creator>, *mut c_void);
      lynx_env_register_extension_module:
        unsafe extern "C" fn(*const c_char, Option<extension_module_creator>, bool, *mut c_void);
    }
    optional {
    }
  }
  header "lynx_group_capi.h" {
    required {
      lynx_group_create: unsafe extern "C" fn(*const c_char) -> *mut lynx_group_t;
      lynx_group_create_with_id:
        unsafe extern "C" fn(*const c_char, *const c_char) -> *mut lynx_group_t;
      lynx_group_set_preload_js_paths:
        unsafe extern "C" fn(*mut lynx_group_t, *const *const c_char, usize);
      lynx_group_set_enable_js_group_thread: unsafe extern "C" fn(*mut lynx_group_t, c_int);
      lynx_group_release: unsafe extern "C" fn(*mut lynx_group_t);
    }
    optional {
    }
  }
  header "lynx_view_builder_capi.h" {
    required {
      lynx_view_builder_create: unsafe extern "C" fn() -> *mut lynx_view_builder_t;
      lynx_view_builder_set_screen_size:
        unsafe extern "C" fn(*mut lynx_view_builder_t, *const f32, *const f32, *const f32);
      lynx_view_builder_set_frame: unsafe extern "C" fn(
        *mut lynx_view_builder_t,
        *const f32,
        *const f32,
        *const f32,
        *const f32,
      );
      lynx_view_builder_set_font_scale: unsafe extern "C" fn(*mut lynx_view_builder_t, *const f32);
      lynx_view_builder_set_icu_data_path:
        unsafe extern "C" fn(*mut lynx_view_builder_t, *const c_char);
      lynx_view_builder_set_webview2_fixed_runtime_path:
        unsafe extern "C" fn(*mut lynx_view_builder_t, *const c_char);
      lynx_view_builder_set_lynx_group:
        unsafe extern "C" fn(*mut lynx_view_builder_t, *mut lynx_group_t);
      lynx_view_builder_set_parent: unsafe extern "C" fn(*mut lynx_view_builder_t, NativeWindow);
      lynx_view_builder_set_windowless_renderer:
        unsafe extern "C" fn(*mut lynx_view_builder_t, *mut lynx_windowless_renderer_t);
      lynx_view_builder_set_generic_resource_fetcher:
        unsafe extern "C" fn(*mut lynx_view_builder_t, *mut lynx_generic_resource_fetcher_t);
      lynx_view_builder_register_native_module: unsafe extern "C" fn(
        *mut lynx_view_builder_t,
        *const c_char,
        Option<napi_module_creator>,
        *mut c_void,
      );
      lynx_view_builder_register_extension_module: unsafe extern "C" fn(
        *mut lynx_view_builder_t,
        *const c_char,
        Option<extension_module_creator>,
        bool,
        *mut c_void,
      );
      lynx_view_builder_register_native_view: unsafe extern "C" fn(
        *mut lynx_view_builder_t,
        *const c_char,
        Option<lynx_native_view_creator>,
        *mut c_void,
      );
      lynx_view_builder_release: unsafe extern "C" fn(*mut lynx_view_builder_t);
    }
    optional {
    }
  }
  header "lynx_view_capi.h" {
    required {
      lynx_view_create:
        unsafe extern "C" fn(*mut lynx_view_builder_t, *mut c_void) -> *mut lynx_view_t;
      lynx_view_get_user_data: unsafe extern "C" fn(*mut lynx_view_t) -> *mut c_void;
      lynx_view_get_webview2_fixed_runtime_path:
        unsafe extern "C" fn(*mut lynx_view_t) -> *const c_char;
      lynx_view_release: unsafe extern "C" fn(*mut lynx_view_t);
      lynx_view_add_client: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_view_client_t);
      lynx_view_remove_client: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_view_client_t);
      lynx_view_register_runtime_lifecycle_observer:
        unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_runtime_lifecycle_observer_t);
      lynx_view_load_template: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_load_meta_t);
      lynx_view_update_data: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_update_meta_t);
      lynx_view_reload_template: unsafe extern "C" fn(
        *mut lynx_view_t,
        *mut lynx_template_data_t,
        *mut lynx_template_data_t,
      );
      lynx_view_send_global_event:
        unsafe extern "C" fn(*mut lynx_view_t, *const c_char, *const c_char);
      lynx_view_send_touch_event:
        unsafe extern "C" fn(*mut lynx_view_t, *const c_char, i32, f32, f32, f32, f32, f32, f32);
      lynx_view_update_screen_metrics:
        unsafe extern "C" fn(*mut lynx_view_t, *const f32, *const f32, *const f32);
      lynx_view_set_frame:
        unsafe extern "C" fn(*mut lynx_view_t, *const f32, *const f32, *const f32, *const f32);
      lynx_view_set_font_scale: unsafe extern "C" fn(*mut lynx_view_t, *const f32);
      lynx_view_set_parent: unsafe extern "C" fn(*mut lynx_view_t, NativeWindow);
      lynx_view_get_native_window: unsafe extern "C" fn(*mut lynx_view_t) -> NativeWindow;
      lynx_view_get_generic_resource_fetcher:
        unsafe extern "C" fn(*mut lynx_view_t) -> *mut lynx_generic_resource_fetcher_t;
      lynx_view_enter_foreground: unsafe extern "C" fn(*mut lynx_view_t);
      lynx_view_enter_background: unsafe extern "C" fn(*mut lynx_view_t);
      lynx_view_inject_bubble_event: unsafe extern "C" fn(*mut lynx_view_t, *const c_char);
      lynx_view_register_native_view: unsafe extern "C" fn(
        *mut lynx_view_t,
        *const c_char,
        Option<lynx_native_view_creator>,
        *mut c_void,
      );
      lynx_view_register_ime_handler:
        unsafe extern "C" fn(*mut lynx_view_t, *mut c_void, *mut c_void);
      lynx_view_set_custom_vsync_monitor:
        unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_vsync_monitor_t);
      lynx_view_set_event_simulation_proxy:
        unsafe extern "C" fn(*mut lynx_view_t, Option<lynx_emulate_touch_fn>, *mut c_void);
      lynx_view_get_node_for_location:
        unsafe extern "C" fn(*mut lynx_view_t, c_int, c_int) -> c_int;
      lynx_view_emulate_mouse_event:
        unsafe extern "C" fn(*mut lynx_view_t, *const c_char, f32, f32, f32, f32);
    }
    optional {
      lynx_view_get_devtool_target:
        unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_devtool_target_t) -> bool;
      lynx_view_load_lynx_ml: unsafe extern "C" fn(
        *mut lynx_view_t,
        *const c_char,
        *const c_char,
        *mut lynx_template_data_t,
      );
      lynx_view_set_event_simulation_callbacks: unsafe extern "C" fn(
        *mut lynx_view_t,
        Option<lynx_emulate_touch_fn>,
        Option<lynx_focus_fn>,
        Option<lynx_insert_text_fn>,
        *mut c_void,
      );
    }
  }
  header "lynx_load_meta_capi.h" {
    required {
      lynx_load_meta_create: unsafe extern "C" fn() -> *mut lynx_load_meta_t;
      lynx_load_meta_set_url: unsafe extern "C" fn(*mut lynx_load_meta_t, *const c_char);
      lynx_load_meta_set_binary_data: unsafe extern "C" fn(
        *mut lynx_load_meta_t,
        *mut u8,
        usize,
        Option<binary_data_dtor>,
        *mut c_void,
      );
      lynx_load_meta_set_template_bundle:
        unsafe extern "C" fn(*mut lynx_load_meta_t, *mut lynx_template_bundle_t);
      lynx_load_meta_set_initial_data:
        unsafe extern "C" fn(*mut lynx_load_meta_t, *mut lynx_template_data_t);
      lynx_load_meta_set_global_props:
        unsafe extern "C" fn(*mut lynx_load_meta_t, *mut lynx_template_data_t);
      lynx_load_meta_release: unsafe extern "C" fn(*mut lynx_load_meta_t);
    }
    optional {
    }
  }
  header "lynx_update_meta_capi.h" {
    required {
      lynx_update_meta_create: unsafe extern "C" fn() -> *mut lynx_update_meta_t;
      lynx_update_meta_set_update_data:
        unsafe extern "C" fn(*mut lynx_update_meta_t, *mut lynx_template_data_t);
      lynx_update_meta_set_global_props:
        unsafe extern "C" fn(*mut lynx_update_meta_t, *mut lynx_template_data_t);
      lynx_update_meta_release: unsafe extern "C" fn(*mut lynx_update_meta_t);
    }
    optional {
    }
  }
  header "lynx_template_data_capi.h" {
    required {
      lynx_template_data_create_from_json:
        unsafe extern "C" fn(*const c_char) -> *mut lynx_template_data_t;
      lynx_template_data_release: unsafe extern "C" fn(*mut lynx_template_data_t);
    }
    optional {
    }
  }
  header "lynx_template_bundle_capi.h" {
    required {
      lynx_template_bundle_create: unsafe extern "C" fn(
        *mut u8,
        usize,
        Option<binary_data_dtor>,
        *mut c_void,
      ) -> *mut lynx_template_bundle_t;
      lynx_template_bundle_is_valid: unsafe extern "C" fn(*mut lynx_template_bundle_t) -> c_int;
      lynx_template_bundle_get_error_message:
        unsafe extern "C" fn(*mut lynx_template_bundle_t) -> *const c_char;
      lynx_template_bundle_release: unsafe extern "C" fn(*mut lynx_template_bundle_t);
    }
    optional {
    }
  }
  header "lynx_generic_resource_fetcher_capi.h" {
    required {
      lynx_generic_resource_fetcher_create_with_finalizer: unsafe extern "C" fn(
        *mut c_void,
        Option<lynx_generic_resource_fetcher_finalizer>,
      ) -> *mut lynx_generic_resource_fetcher_t;
      lynx_generic_resource_fetcher_bind_fetch_resource:
        unsafe extern "C" fn(*mut lynx_generic_resource_fetcher_t, Option<fetch_resource_func>);
      lynx_generic_resource_fetcher_bind_fetch_resource_path:
        unsafe extern "C" fn(*mut lynx_generic_resource_fetcher_t, Option<fetch_resource_func>);
      lynx_generic_resource_fetcher_bind_cancel_fetch:
        unsafe extern "C" fn(*mut lynx_generic_resource_fetcher_t, Option<cancel_fetch_func>);
      lynx_generic_resource_fetcher_release:
        unsafe extern "C" fn(*mut lynx_generic_resource_fetcher_t);
    }
    optional {
    }
  }
  header "lynx_resource_request_capi.h" {
    required {
      lynx_resource_request_get_id:
        unsafe extern "C" fn(*mut lynx_resource_request_t) -> lynx_resource_request_id;
      lynx_resource_request_get_type:
        unsafe extern "C" fn(*mut lynx_resource_request_t) -> lynx_resource_type_e;
      lynx_resource_request_get_url:
        unsafe extern "C" fn(*mut lynx_resource_request_t) -> *const c_char;
      lynx_resource_request_release: unsafe extern "C" fn(*mut lynx_resource_request_t);
    }
    optional {
    }
  }
  header "lynx_resource_response_capi.h" {
    required {
      lynx_resource_response_set_code: unsafe extern "C" fn(*mut lynx_resource_response_t, c_int);
      lynx_resource_response_set_error_message:
        unsafe extern "C" fn(*mut lynx_resource_response_t, *const c_char);
      lynx_resource_response_set_data: unsafe extern "C" fn(
        *mut lynx_resource_response_t,
        *mut u8,
        usize,
        Option<binary_data_dtor>,
        *mut c_void,
      );
      lynx_resource_response_callback: unsafe extern "C" fn(*mut lynx_resource_response_t);
      lynx_resource_response_release: unsafe extern "C" fn(*mut lynx_resource_response_t);
    }
    optional {
    }
  }
  header "lynx_windowless_renderer_capi.h" {
    required {
      lynx_windowless_set_global_ui_task_runner:
        unsafe extern "C" fn(*const lynx_windowless_ui_task_runner_config_t) -> bool;
      lynx_windowless_run_ui_task: unsafe extern "C" fn(lynx_task_t) -> bool;
      lynx_windowless_renderer_create_with_finalizer: unsafe extern "C" fn(
        lynx_windowless_renderer_type_e,
        *mut c_void,
        Option<lynx_windowless_renderer_finalizer>,
      ) -> *mut lynx_windowless_renderer_t;
      lynx_windowless_renderer_bind_on_gl_make_current:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_gl_make_current>);
      lynx_windowless_renderer_bind_on_gl_clear_current:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_gl_clear_current>);
      lynx_windowless_renderer_bind_on_gl_present:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_gl_present>);
      lynx_windowless_renderer_bind_on_gl_create_fbo:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_gl_create_fbo>);
      lynx_windowless_renderer_bind_on_gl_proc_resolver:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_gl_proc_resolver>);
      lynx_windowless_renderer_bind_on_software_present:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_software_present>);
      lynx_windowless_renderer_bind_on_accelerated_present:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_accelerated_present>);
      lynx_windowless_renderer_get_accelerated_paint_info: unsafe extern "C" fn(
        *mut lynx_windowless_renderer_t,
        *mut lynx_accelerated_paint_info_t,
      ) -> bool;
      lynx_windowless_renderer_bind_on_post_task:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_post_task>);
      lynx_windowless_renderer_run_task:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, lynx_task_t);
      lynx_windowless_renderer_send_pointer_event:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, *mut lynx_pointer_event_t);
      lynx_windowless_renderer_send_key_event:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, *mut lynx_key_event_t);
      lynx_windowless_renderer_bind_get_clipboard_data:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<get_clipboard_data>);
      lynx_windowless_renderer_bind_set_clipboard_data:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<set_clipboard_data>);
      lynx_windowless_renderer_bind_activate_system_cursor:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<activate_system_cursor>);
      lynx_windowless_renderer_bind_show_text_input:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<show_text_input>);
      lynx_windowless_renderer_bind_update_caret_position:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<update_caret_position>);
      lynx_windowless_renderer_bind_set_cursor_position:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<set_cursor_position>);
      lynx_windowless_renderer_bind_set_marked_text_rect:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<set_marked_text_rect>);
      lynx_windowless_renderer_bind_set_editable_transform:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<set_editable_transform>);
      lynx_windowless_renderer_release: unsafe extern "C" fn(*mut lynx_windowless_renderer_t);
    }
    optional {
    }
  }
}

// Public CAPI exports intentionally not loaded because no Rust implementation
// path uses them. Keep the signatures here for comparison with their declaring
// headers, and move an entry into define_loaded_library! only with its consumer.
//
// lynx_template_data_capi.h:
// lynx_template_data_mark_state:
//   unsafe extern "C" fn(*mut lynx_template_data_t, *const c_char);
// lynx_template_data_set_read_only:
//   unsafe extern "C" fn(*mut lynx_template_data_t, c_int);
//
// lynx_view_client_capi.h:
// lynx_view_client_create:
//   unsafe extern "C" fn(*mut c_void) -> *mut lynx_view_client_t;
// lynx_view_client_get_user_data:
//   unsafe extern "C" fn(*mut lynx_view_client_t) -> *mut c_void;
// lynx_view_client_bind_on_page_start:
//   unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_page_start>);
// lynx_view_client_bind_on_load_success:
//   unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_load_success>);
// lynx_view_client_bind_on_first_screen:
//   unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_first_screen>);
// lynx_view_client_bind_on_page_updated:
//   unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_page_updated>);
// lynx_view_client_bind_on_data_updated:
//   unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_data_updated>);
// lynx_view_client_bind_on_destroy:
//   unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_destroy>);
// lynx_view_client_bind_on_runtime_ready:
//   unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_runtime_ready>);
// lynx_view_client_bind_on_received_error:
//   unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_received_error>);
// lynx_view_client_bind_on_timing_setup:
//   unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_timing_setup>);
// lynx_view_client_bind_on_timing_update:
//   unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_timing_update>);
// lynx_view_client_bind_on_enter_foreground:
//   unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_enter_foreground>);
// lynx_view_client_bind_on_enter_background:
//   unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_enter_background>);
// lynx_view_client_bind_on_frame_timing:
//   unsafe extern "C" fn(*mut lynx_view_client_t, Option<on_frame_timing>);
// lynx_view_client_release:
//   unsafe extern "C" fn(*mut lynx_view_client_t);

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
  fn loaded_symbol_manifest_has_one_unique_entry_per_field_and_resolver() {
    // Each manifest entry expands into exactly one field and one resolver. The
    // compiler rejects missing or duplicate struct fields; these assertions
    // additionally pin the expected public ABI surface and compatibility split.
    assert_eq!(LOADED_LIBRARY_SYMBOLS.len(), 115);

    let mut names = HashSet::new();
    let mut required_count = 0;
    let mut optional_names = Vec::new();
    for symbol in LOADED_LIBRARY_SYMBOLS {
      assert!(symbol.header.ends_with("_capi.h"));
      assert!(
        names.insert(symbol.name),
        "duplicate symbol {}",
        symbol.name
      );
      match symbol.requirement {
        LoadedSymbolRequirement::Required => required_count += 1,
        LoadedSymbolRequirement::Optional => optional_names.push(symbol.name),
      }
    }

    optional_names.sort_unstable();
    assert_eq!(required_count, 112);
    assert_eq!(
      optional_names,
      [
        "lynx_view_get_devtool_target",
        "lynx_view_load_lynx_ml",
        "lynx_view_set_event_simulation_callbacks",
      ]
    );
  }

  #[test]
  fn loaded_symbol_manifest_excludes_private_rust_shims() {
    assert!(LOADED_LIBRARY_SYMBOLS.iter().all(|symbol| {
      symbol.name.starts_with("lynx_") && !symbol.name.starts_with("lynx_rust_")
    }));
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
