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
      header $_header:literal {
        required {
          $(
            $(#[$required_attr:meta])*
            $required_name:ident: $required_type:ty;
          )*
        }
        optional {
          $(
            $(#[$optional_attr:meta])*
            $optional_name:ident: $optional_type:ty;
          )*
        }
      }
    )*
  ) => {
    #[allow(non_camel_case_types)]
    pub struct LoadedLibrary {
      _library: DynamicLibrary,
      pub path: PathBuf,
      $(
        $(
          $(#[$required_attr])*
          pub $required_name: $required_type,
        )*
        $(
          $(#[$optional_attr])*
          pub $optional_name: Option<$optional_type>,
        )*
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
            name: stringify!($required_name),
            requirement: LoadedSymbolRequirement::Required,
          },
        )*
        $(
          LoadedSymbolSpec {
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
      /// Retrieves the SDK version of Lynx sdk.
      lynx_env_get_sdk_version: unsafe extern "C" fn() -> *const c_char;
      /// Sets the ICU data path for the LynxEnv.
      lynx_env_set_icu_data_path: unsafe extern "C" fn(*const c_char);
      /// Retrieves the ICU data path for the LynxEnv.
      lynx_env_get_icu_data_path: unsafe extern "C" fn() -> *const c_char;
      lynx_env_set_devtool_app_info: unsafe extern "C" fn(*const c_char, *const c_char);
      lynx_env_enable_devtool: unsafe extern "C" fn(c_int);
      lynx_env_is_devtool_enabled: unsafe extern "C" fn() -> c_int;
      lynx_env_connect_devtool: unsafe extern "C" fn(*const c_char) -> c_int;
      /// logbox
      lynx_env_enable_logbox: unsafe extern "C" fn(c_int);
      lynx_env_is_logbox_enabled: unsafe extern "C" fn() -> c_int;
      /// Global native module
      lynx_env_register_native_module:
        unsafe extern "C" fn(*const c_char, Option<napi_module_creator>, *mut c_void);
      /// Global extension module
      lynx_env_register_extension_module:
        unsafe extern "C" fn(*const c_char, Option<extension_module_creator>, bool, *mut c_void);
    }
    optional {
    }
  }
  header "lynx_group_capi.h" {
    required {
      /// Create a group with the given. A unique ID will be generated as group ID.
      lynx_group_create: unsafe extern "C" fn(*const c_char) -> *mut lynx_group_t;
      /// Create a group with the given name and ID. If the ID is not provided, a
      /// unique ID will be generated. The ID should ideally be set to
      /// `LYNX_SINGLE_GROUP` Other values are considered experimental features and
      /// should be used with caution.
      lynx_group_create_with_id:
        unsafe extern "C" fn(*const c_char, *const c_char) -> *mut lynx_group_t;
      /// Sets the preload JavaScript file paths for a lynx group. This function allows
      /// you to specify an array of JavaScript file paths that should be preloaded for
      /// a given lynx group.
      lynx_group_set_preload_js_paths:
        unsafe extern "C" fn(*mut lynx_group_t, *const *const c_char, usize);
      /// Enables or disables the JavaScript group thread for a lynx group.
      lynx_group_set_enable_js_group_thread: unsafe extern "C" fn(*mut lynx_group_t, c_int);
      /// Release the lynx group.
      lynx_group_release: unsafe extern "C" fn(*mut lynx_group_t);
    }
    optional {
    }
  }
  header "lynx_view_builder_capi.h" {
    required {
      lynx_view_builder_create: unsafe extern "C" fn() -> *mut lynx_view_builder_t;
      /// Sets the screen size and pixel ratio for the LynxView being built. This
      /// function allows you to specify the screen size and pixel ratio of the device
      /// for the LynxView that is being constructed using the provided builder. The
      /// screen size affects the layout and rendering of the LynxView, and the pixel
      /// ratio is used to adjust the rendering quality of high - DPI displays.
      lynx_view_builder_set_screen_size:
        unsafe extern "C" fn(*mut lynx_view_builder_t, *const f32, *const f32, *const f32);
      /// Set the initial position and size of the LynxView. This function allows you
      /// to specify the initial position and dimensions of the LynxView being built
      /// using the provided builder. The position is defined by the `x` and `y`
      /// coordinates, and the size is defined by the `width` and `height` parameters.
      lynx_view_builder_set_frame: unsafe extern "C" fn(
        *mut lynx_view_builder_t,
        *const f32,
        *const f32,
        *const f32,
        *const f32,
      );
      /// Sets the font scaling ratio for the LynxView being built. This function
      /// allows you to specify a scaling factor for the font size within the LynxView.
      /// The text size in the LynxView will be multiplied by this scaling ratio. For
      /// example, a value of 1.5 will increase the text size by 50%, while 0.8 will
      /// reduce it by 20%.
      lynx_view_builder_set_font_scale: unsafe extern "C" fn(*mut lynx_view_builder_t, *const f32);
      /// Controls whether the LynxView creates and runs a JavaScript runtime.
      lynx_view_builder_set_enable_js_runtime:
        unsafe extern "C" fn(*mut lynx_view_builder_t, bool);
      /// Sets the ICU data path for the LynxView being built. This function allows you
      /// to specify the path to the ICU (International Components for Unicode) data
      /// file that the LynxView will use for Unicode-related operations such as text
      /// processing, collation, and formatting. The ICU data is essential for proper
      /// handling of international text and multilingual support in the LynxView.
      lynx_view_builder_set_icu_data_path:
        unsafe extern "C" fn(*mut lynx_view_builder_t, *const c_char);
      /// Associates a Lynx group with the LynxView being built. This function allows
      /// you to assign a specific Lynx group to the LynxView that is currently under
      /// construction using the provided builder. The Lynx group can contain shared
      /// resources, configurations, or state that the LynxView may utilize. By
      /// associating a Lynx group, the LynxView can inherit and interact with the
      /// group's context, which can be useful for managing resources and coordinating
      /// behavior across multiple views.
      lynx_view_builder_set_lynx_group:
        unsafe extern "C" fn(*mut lynx_view_builder_t, *mut lynx_group_t);
      /// Sets the windowless renderer for the Lynx view being built. This function
      /// assigns a windowless renderer to the Lynx view that is being constructed
      /// using the provided builder. The windowless renderer is responsible for
      /// rendering the Lynx view without a visible window, which can be useful for
      /// offscreen rendering or headless scenarios.
      lynx_view_builder_set_windowless_renderer:
        unsafe extern "C" fn(*mut lynx_view_builder_t, *mut lynx_windowless_renderer_t);
      /// generic fetcher.
      lynx_view_builder_set_generic_resource_fetcher:
        unsafe extern "C" fn(*mut lynx_view_builder_t, *mut lynx_generic_resource_fetcher_t);
      /// Register instance-level native module, which have a higher priority than
      /// global modules.
      lynx_view_builder_register_native_module: unsafe extern "C" fn(
        *mut lynx_view_builder_t,
        *const c_char,
        Option<napi_module_creator>,
        *mut c_void,
      );
      /// Register instance-level extension module, which have a higher priority than
      /// global extension modules.
      lynx_view_builder_register_extension_module: unsafe extern "C" fn(
        *mut lynx_view_builder_t,
        *const c_char,
        Option<extension_module_creator>,
        bool,
        *mut c_void,
      );
      /// Register instance-level view factory.
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
      /// Create lynx view with builder.
      lynx_view_create:
        unsafe extern "C" fn(*mut lynx_view_builder_t, *mut c_void) -> *mut lynx_view_t;
      lynx_view_get_user_data: unsafe extern "C" fn(*mut lynx_view_t) -> *mut c_void;
      /// Users should call lynx_view_release() to release the LynxView when it is no
      /// longer needed.
      lynx_view_release: unsafe extern "C" fn(*mut lynx_view_t);
      /// Register lifecycle event observer for LynxView. The client passed in is the
      /// structure implemented by user and registered to the LynxView instance is used
      /// to obtain the callbacks of each process in the LynxView lifecycle.
      lynx_view_add_client: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_view_client_t);
      lynx_view_remove_client: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_view_client_t);
      /// Register a runtime lifecycle observer for the LynxView.
      /// This function allows you to associate a runtime lifecycle observer with a
      /// specific LynxView instance. The observer will be notified of various runtime
      /// lifecycle events, such as runtime attachment, and detachment. This can be
      /// useful for monitoring and responding to changes in the runtime state.
      lynx_view_register_runtime_lifecycle_observer:
        unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_runtime_lifecycle_observer_t);
      /// Using LynxLoadMeta to render LynxView, it is the main entrance for the client
      /// to load Lynx templates.
      lynx_view_load_template: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_load_meta_t);
      /// Using LynxUpdateMeta to update LynxView, it is the main entrance for the
      /// client to update template data.
      lynx_view_update_data: unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_update_meta_t);
      /// Reload the template of the LynxView with the given data. This function
      /// reloads the template of the specified LynxView using the provided template
      /// data and global properties. It can be used when you need to refresh the view
      /// with updated data or different template configurations.
      lynx_view_reload_template: unsafe extern "C" fn(
        *mut lynx_view_t,
        *mut lynx_template_data_t,
        *mut lynx_template_data_t,
      );
      /// Send global events to the front end through the client, and the front end can
      /// listen to the event through GlobalEventEmitter.
      lynx_view_send_global_event:
        unsafe extern "C" fn(*mut lynx_view_t, *const c_char, *const c_char);
      lynx_view_send_touch_event:
        unsafe extern "C" fn(*mut lynx_view_t, *const c_char, i32, f32, f32, f32, f32, f32, f32);
      /// Update the screen metrics of the LynxView. This function allows you to modify
      /// the screen-related properties of an existing LynxView, including the screen
      /// width, height, and pixel ratio.
      lynx_view_update_screen_metrics:
        unsafe extern "C" fn(*mut lynx_view_t, *const f32, *const f32, *const f32);
      /// Updates the position and size of the LynxView. This function allows you to
      /// change the position and dimensions of an existing LynxView. The position is
      /// defined by the `x` and `y` coordinates of the top-left corner of the view,
      /// and the size is defined by the `width` and `height` parameters.
      lynx_view_set_frame:
        unsafe extern "C" fn(*mut lynx_view_t, *const f32, *const f32, *const f32, *const f32);
      /// Changing the font scaling ratio in client settings will automatically change
      /// the text size.
      lynx_view_set_font_scale: unsafe extern "C" fn(*mut lynx_view_t, *const f32);
      /// Get the generic resource fetcher of the LynxView. This function increases the
      /// reference count of the returned fetcher. The caller assumes ownership and is
      /// responsible for calling `lynx_generic_resource_fetcher_release` to release
      /// it when no longer needed.
      lynx_view_get_generic_resource_fetcher:
        unsafe extern "C" fn(*mut lynx_view_t) -> *mut lynx_generic_resource_fetcher_t;
      /// Instruct the LynxView to enter the foreground state. This function should be
      /// called when the LynxView becomes visible or active again after being in the
      /// background. It may trigger necessary operations such as resuming animations,
      /// reloading resources, or updating the UI.
      lynx_view_enter_foreground: unsafe extern "C" fn(*mut lynx_view_t);
      /// Instruct the LynxView to enter the background state. This function should be
      /// called when the LynxView is about to become hidden or inactive, such as when
      /// the app is sent to the background. It may trigger operations like pausing
      /// animations, releasing resources, or saving the current state to ensure
      /// efficient resource usage and a smooth transition when the view returns to the
      /// foreground.
      lynx_view_enter_background: unsafe extern "C" fn(*mut lynx_view_t);
      /// Send bubble event to lynx view. This function is only used by test bench to
      /// replay the bubble event.
      lynx_view_inject_bubble_event: unsafe extern "C" fn(*mut lynx_view_t, *const c_char);
      /// Register instance-level view factory.
      lynx_view_register_native_view: unsafe extern "C" fn(
        *mut lynx_view_t,
        *const c_char,
        Option<lynx_native_view_creator>,
        *mut c_void,
      );
      /// Register Input Method Editor (IME) handler for the LynxView.
      /// When registering IME (handler != NULL), the provided handler will be invoked
      /// to handle keyboard events. When releasing IME (handler == NULL), the IME
      /// will be hidden and no further keyboard events will be sent.
      lynx_view_register_ime_handler:
        unsafe extern "C" fn(*mut lynx_view_t, *mut c_void, *mut c_void);
      /// Set a custom vsync monitor to request a synchronous vsync signal
      lynx_view_set_custom_vsync_monitor:
        unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_vsync_monitor_t);
      /// Set event simulation proxy for devtool. The callback will be invoked to
      /// emulate touch/mouse events. Pass NULL callback to clear the proxy.
      lynx_view_set_event_simulation_proxy:
        unsafe extern "C" fn(*mut lynx_view_t, Option<lynx_emulate_touch_fn>, *mut c_void);
      lynx_view_get_node_for_location:
        unsafe extern "C" fn(*mut lynx_view_t, c_int, c_int) -> c_int;
      lynx_view_emulate_mouse_event:
        unsafe extern "C" fn(*mut lynx_view_t, *const c_char, f32, f32, f32, f32);
    }
    optional {
      /// Returns false until this LynxView is attached to the DebugRouter.
      lynx_view_get_devtool_target:
        unsafe extern "C" fn(*mut lynx_view_t, *mut lynx_devtool_target_t) -> bool;
      /// EXPERIMENTAL API.
      /// Loads a LynxML source document with initial template data. LynxML is a
      /// single-file template format that is parsed and built into a template bundle
      /// at load time. Both this API and the LynxML format may change in future
      /// releases. The initial data may be null.
      lynx_view_load_lynx_ml: unsafe extern "C" fn(
        *mut lynx_view_t,
        *const c_char,
        *const c_char,
        *mut lynx_template_data_t,
      );
      /// Set all event simulation callbacks for devtool. This additive API preserves
      /// the touch-only setter above for existing C API consumers.
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
      /// The file path of the template.
      lynx_load_meta_set_url: unsafe extern "C" fn(*mut lynx_load_meta_t, *const c_char);
      /// The binary file data of the template. You can also
      /// provide a custom destructor function to handle the cleanup of the content
      /// memory, and pass an opaque pointer for additional context.
      lynx_load_meta_set_binary_data: unsafe extern "C" fn(
        *mut lynx_load_meta_t,
        *mut u8,
        usize,
        Option<binary_data_dtor>,
        *mut c_void,
      );
      /// TemplateBundle object parsed in advance by the template's binary file data
      lynx_load_meta_set_template_bundle:
        unsafe extern "C" fn(*mut lynx_load_meta_t, *mut lynx_template_bundle_t);
      /// Set the initial data for the template. Initial data specified by the client
      /// during the first screen loading process
      lynx_load_meta_set_initial_data:
        unsafe extern "C" fn(*mut lynx_load_meta_t, *mut lynx_template_data_t);
      /// Set the global props data for the template.
      lynx_load_meta_set_global_props:
        unsafe extern "C" fn(*mut lynx_load_meta_t, *mut lynx_template_data_t);
      /// Release the load meta.
      lynx_load_meta_release: unsafe extern "C" fn(*mut lynx_load_meta_t);
    }
    optional {
    }
  }
  header "lynx_update_meta_capi.h" {
    required {
      lynx_update_meta_create: unsafe extern "C" fn() -> *mut lynx_update_meta_t;
      /// The content of the data to update the template.
      lynx_update_meta_set_update_data:
        unsafe extern "C" fn(*mut lynx_update_meta_t, *mut lynx_template_data_t);
      /// The globalProps content for updating the template;
      lynx_update_meta_set_global_props:
        unsafe extern "C" fn(*mut lynx_update_meta_t, *mut lynx_template_data_t);
      /// Release the update meta.
      lynx_update_meta_release: unsafe extern "C" fn(*mut lynx_update_meta_t);
    }
    optional {
    }
  }
  header "lynx_template_data_capi.h" {
    required {
      /// Create a template data from json string.
      lynx_template_data_create_from_json:
        unsafe extern "C" fn(*const c_char) -> *mut lynx_template_data_t;
      /// Release the template data. This will be called automatically if
      /// lynx_view_load_template is called, otherwise the caller is responsible for
      /// calling this function to release the template data.
      lynx_template_data_release: unsafe extern "C" fn(*mut lynx_template_data_t);
    }
    optional {
    }
  }
  header "lynx_template_bundle_capi.h" {
    required {
      /// Create a template bundle from the given content. You can also
      /// provide a custom destructor function to handle the cleanup of the content
      /// memory, and pass an opaque pointer for additional context.
      lynx_template_bundle_create: unsafe extern "C" fn(
        *mut u8,
        usize,
        Option<binary_data_dtor>,
        *mut c_void,
      ) -> *mut lynx_template_bundle_t;
      /// Check if the template bundle is valid. If not, the error message can be
      /// obtained by calling lynx_template_bundle_get_error_message.
      /// Return 1 if valid, 0 otherwise.
      lynx_template_bundle_is_valid: unsafe extern "C" fn(*mut lynx_template_bundle_t) -> c_int;
      /// Get the error message if the template bundle is not valid.
      lynx_template_bundle_get_error_message:
        unsafe extern "C" fn(*mut lynx_template_bundle_t) -> *const c_char;
      /// Release the template bundle. This will be called automatically if
      /// lynx_view_load_template is called, otherwise the caller is responsible for
      /// calling this function to release the bundle.
      lynx_template_bundle_release: unsafe extern "C" fn(*mut lynx_template_bundle_t);
    }
    optional {
    }
  }
  header "lynx_memory_capi.h" {
    required {
      /// Duplicates a null-terminated string using the Lynx runtime allocator.
      /// The returned string is released by the runtime with `lynx_free`.
      lynx_strdup: unsafe extern "C" fn(*const c_char) -> *mut c_char;
    }
    optional {
    }
  }
  header "lynx_generic_resource_fetcher_capi.h" {
    required {
      /// Creates a new generic resource fetcher instance with a finalizer. This
      /// function allocates and initializes a new generic resource fetcher object. It
      /// associates the provided user data with the fetcher and sets a finalizer
      /// function that will be called when the fetcher is released.
      lynx_generic_resource_fetcher_create_with_finalizer: unsafe extern "C" fn(
        *mut c_void,
        Option<lynx_generic_resource_fetcher_finalizer>,
      ) -> *mut lynx_generic_resource_fetcher_t;
      /// Binds a resource fetching callback to a generic resource fetcher. This
      /// function sets the resource fetching callback function for the given generic
      /// resource fetcher instance. The callback will be invoked when a resource needs
      /// to be fetched.
      lynx_generic_resource_fetcher_bind_fetch_resource:
        unsafe extern "C" fn(*mut lynx_generic_resource_fetcher_t, Option<fetch_resource_func>);
      /// Binds a resource path fetching callback to a generic resource fetcher. This
      /// function sets the resource path fetching callback function for the given
      /// generic resource fetcher instance. The callback will be invoked when the path
      /// of a resource needs to be fetched.
      lynx_generic_resource_fetcher_bind_fetch_resource_path:
        unsafe extern "C" fn(*mut lynx_generic_resource_fetcher_t, Option<fetch_resource_func>);
      /// Binds a resource fetch cancellation callback to a generic resource fetcher.
      /// This function sets the resource fetch cancellation callback function for the
      /// given generic resource fetcher instance. The callback will be invoked when a
      /// resource fetch request needs to be cancelled.
      lynx_generic_resource_fetcher_bind_cancel_fetch:
        unsafe extern "C" fn(*mut lynx_generic_resource_fetcher_t, Option<cancel_fetch_func>);
      /// Binds a URL interception callback to a generic resource fetcher. The
      /// callback transforms a URL before the corresponding resource request.
      lynx_generic_resource_fetcher_bind_intercept_func: unsafe extern "C" fn(
        *mut lynx_generic_resource_fetcher_t,
        Option<lynx_resource_intercept_func>,
      );
      /// Releases a generic resource fetcher instance. This function deallocates the
      /// memory used by the given generic resource fetcher instance and calls the
      /// finalizer function if one was set during creation. After calling this
      /// function, the provided pointer becomes invalid.
      lynx_generic_resource_fetcher_release:
        unsafe extern "C" fn(*mut lynx_generic_resource_fetcher_t);
    }
    optional {
    }
  }
  header "lynx_resource_request_capi.h" {
    required {
      /// This function fetches the unique identifier associated with the specified
      /// `lynx_resource_request_t` object. Each resource request is assigned a
      /// distinct identifier upon creation, which can be used to track and manage the
      /// request throughout its lifecycle, such as canceling it later.
      lynx_resource_request_get_id:
        unsafe extern "C" fn(*mut lynx_resource_request_t) -> lynx_resource_request_id;
      /// Retrieves the type of a resource request. This function determines and
      /// returns the type of the resource request represented by the provided
      /// `lynx_resource_request_t` object. The type is identified using the
      /// `lynx_resource_type_e` enumeration, where each enumerator corresponds to a
      /// specific type of resource that can be requested.
      lynx_resource_request_get_type:
        unsafe extern "C" fn(*mut lynx_resource_request_t) -> lynx_resource_type_e;
      /// Retrieves the URL of the resource request. This function returns a pointer to
      /// a null-terminated string representing the URL of the given resource request.
      /// The returned string is owned by the `lynx_resource_request_t` object and
      /// should not be modified or freed by the caller.
      lynx_resource_request_get_url:
        unsafe extern "C" fn(*mut lynx_resource_request_t) -> *const c_char;
      lynx_resource_request_release: unsafe extern "C" fn(*mut lynx_resource_request_t);
    }
    optional {
    }
  }
  header "lynx_resource_response_capi.h" {
    required {
      /// Sets the response code for a lynx resource response. The response code can be
      /// used to indicate the status of the resource fetch operation, such as success,
      /// failure, or a specific error condition.
      lynx_resource_response_set_code: unsafe extern "C" fn(*mut lynx_resource_response_t, c_int);
      /// Sets the error message for a lynx resource response. The error message can be
      /// used to provide detailed information about the failure of the resource fetch
      /// operation when the response code indicates an error condition.
      lynx_resource_response_set_error_message:
        unsafe extern "C" fn(*mut lynx_resource_response_t, *const c_char);
      /// Sets the data content for a lynx resource response. It also provides an
      /// option to specify a destructor function that will be called when the data is
      /// no longer needed, typically when the response object is released, and pass an
      /// opaque pointer for additional context.
      lynx_resource_response_set_data: unsafe extern "C" fn(
        *mut lynx_resource_response_t,
        *mut u8,
        usize,
        Option<binary_data_dtor>,
        *mut c_void,
      );
      /// Invokes the callback associated with a lynx resource response. This function
      /// triggers the callback functionality for the given `lynx_resource_response_t`
      /// object. It is typically used to notify the caller about the completion of the
      /// resource fetch operation, allowing the caller to handle the response
      /// accordingly, such as processing the data, checking the response code, or
      /// handling errors.
      lynx_resource_response_callback: unsafe extern "C" fn(*mut lynx_resource_response_t);
      lynx_resource_response_release: unsafe extern "C" fn(*mut lynx_resource_response_t);
    }
    optional {
    }
  }
  header "lynx_windowless_renderer_capi.h" {
    required {
      /// Configures the global UI task runner for windowless mode.
      /// This function must be called before creating any windowless renderer.
      /// Returns true if the configuration was successfully set, false if it was
      /// already set or UIThread has already been initialized.
      lynx_windowless_set_global_ui_task_runner:
        unsafe extern "C" fn(*const lynx_windowless_ui_task_runner_config_t) -> bool;
      /// Runs a UI task that was posted via the global UI task runner.
      /// This function should be called by the host on the UI thread.
      /// Returns true if the task was found and executed successfully.
      lynx_windowless_run_ui_task: unsafe extern "C" fn(lynx_task_t) -> bool;
      /// Creates a new windowless handler instance.
      /// This function is the entry point for initializing a windowless handler
      /// with the specified type and optional user data. The finalizer function
      /// will be called when the renderer is released.
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
      /// Gets the accelerated paint info of the windowless renderer. The accelerated
      /// paint info used for presenting on screen is generally obtained by calling
      /// from the host's render thread. Returns true if the call is successful, false
      /// otherwise.
      lynx_windowless_renderer_get_accelerated_paint_info: unsafe extern "C" fn(
        *mut lynx_windowless_renderer_t,
        *mut lynx_accelerated_paint_info_t,
      ) -> bool;
      lynx_windowless_renderer_bind_on_post_task:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, Option<on_post_task>);
      /// Runs a task on the main thread.
      lynx_windowless_renderer_run_task:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, lynx_task_t);
      /// Sends a pointer event to the windowless renderer.
      lynx_windowless_renderer_send_pointer_event:
        unsafe extern "C" fn(*mut lynx_windowless_renderer_t, *mut lynx_pointer_event_t);
      /// Sends a key event to the windowless renderer.
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
// lynx_view_builder_capi.h:
// /// Sets the fixed WebView2 runtime path for the LynxView being built. Windows
// /// WebView native views first try the system WebView2 runtime, then retry with
// /// this fixed runtime path if the system runtime is unavailable or fails.
// lynx_view_builder_set_webview2_fixed_runtime_path:
//   unsafe extern "C" fn(*mut lynx_view_builder_t, *const c_char);
// /// Sets the parent window for the Lynx view being built. This function assigns a
// /// parent native window to the Lynx view that is being constructed using the
// /// provided builder. The parent window will contain the Lynx view, and the
// /// view's position and behavior may be influenced by its parent.
// lynx_view_builder_set_parent:
//   unsafe extern "C" fn(*mut lynx_view_builder_t, *mut c_void);
//
// lynx_view_capi.h:
// /// Get the fixed WebView2 runtime path configured by the builder. Returns an
// /// empty string if no fixed runtime path was configured.
// lynx_view_get_webview2_fixed_runtime_path:
//   unsafe extern "C" fn(*mut lynx_view_t) -> *const c_char;
// /// Set the parent window of the LynxView.
// lynx_view_set_parent:
//   unsafe extern "C" fn(*mut lynx_view_t, *mut c_void);
// /// Get the native window of the LynxView.
// lynx_view_get_native_window:
//   unsafe extern "C" fn(*mut lynx_view_t) -> *mut c_void;
//
// lynx_template_data_capi.h:
// /// Mark the name of data processor. The data processor will be called when
// /// lynx_view_update_data is called.
// lynx_template_data_mark_state:
//   unsafe extern "C" fn(*mut lynx_template_data_t, *const c_char);
// /// Sets the read-only flag for a lynx template data object.
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
    assert_eq!(LOADED_LIBRARY_SYMBOLS.len(), 113);

    let mut names = HashSet::new();
    let mut required_count = 0;
    let mut optional_names = Vec::new();
    for symbol in LOADED_LIBRARY_SYMBOLS {
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
    assert_eq!(required_count, 110);
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
