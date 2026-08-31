use crate::buffer::CByteBuffer;
use crate::group::LynxGroup;
use crate::resource::{GenericResourceFetcher, ResourceFetcher};
use crate::sys;
use crate::{c_str_to_string, c_string, Error, LynxEnv, Result, WindowlessRenderer};
use std::cell::Cell;
use std::ffi::{c_void, CString};
use std::marker::PhantomData;
use std::ptr;
use std::sync::Arc;

/// An owned snapshot of a DevTools target.
///
/// The snapshot may move between threads but is intentionally not shareable.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DevtoolTarget {
  pub session_id: i32,
  pub url: String,
  _not_sync: PhantomData<Cell<()>>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct TouchEvent {
  pub id: i32,
  pub x: f32,
  pub y: f32,
  pub client_x: f32,
  pub client_y: f32,
  pub page_x: f32,
  pub page_y: f32,
}

impl TouchEvent {
  pub fn new(id: i32) -> Self {
    Self {
      id,
      ..Self::default()
    }
  }
}

/// A movable, non-shareable builder for a windowless [`LynxView`].
pub struct HeadlessViewBuilder {
  env: &'static LynxEnv,
  renderer: WindowlessRenderer,
  width: f32,
  height: f32,
  pixel_ratio: f32,
  font_scale: f32,
  enable_js_runtime: bool,
  icu_data_path: Option<CString>,
  user_data: *mut c_void,
  resource_fetcher: Option<GenericResourceFetcher>,
  lynx_group: Option<LynxGroup>,
  native_modules: Vec<RawNativeModule>,
  extension_modules: Vec<RawExtensionModule>,
  native_views: Vec<RawNativeView>,
}

// SAFETY: the builder owns every native wrapper it contains. Its raw callback
// pointers can only be installed through unsafe methods whose contracts require
// them to remain valid after the builder is moved. Shared access stays disabled.
unsafe impl Send for HeadlessViewBuilder {}

struct RawNativeModule {
  name: CString,
  creator: sys::napi_module_creator,
  opaque: *mut c_void,
}

struct RawExtensionModule {
  name: CString,
  creator: sys::extension_module_creator,
  is_lazy_create: bool,
  opaque: *mut c_void,
}

struct RawNativeView {
  name: CString,
  creator: sys::lynx_native_view_creator,
  opaque: *mut c_void,
}

impl HeadlessViewBuilder {
  pub fn new(env: &'static LynxEnv, renderer: WindowlessRenderer) -> Self {
    Self {
      env,
      renderer,
      width: 0.0,
      height: 0.0,
      pixel_ratio: 1.0,
      font_scale: 1.0,
      enable_js_runtime: true,
      icu_data_path: None,
      user_data: ptr::null_mut(),
      resource_fetcher: None,
      lynx_group: None,
      native_modules: Vec::new(),
      extension_modules: Vec::new(),
      native_views: Vec::new(),
    }
  }

  pub fn viewport(mut self, width: f32, height: f32, pixel_ratio: f32) -> Self {
    self.width = width;
    self.height = height;
    self.pixel_ratio = pixel_ratio;
    self
  }

  pub fn font_scale(mut self, font_scale: f32) -> Self {
    self.font_scale = font_scale;
    self
  }

  pub fn enable_js_runtime(mut self, enabled: bool) -> Self {
    self.enable_js_runtime = enabled;
    self
  }

  pub fn icu_data_path(mut self, path: &str) -> Result<Self> {
    self.icu_data_path = Some(c_string(path, "icu_data_path")?);
    Ok(self)
  }

  /// Sets the opaque pointer returned by [`LynxView::user_data_raw`].
  ///
  /// # Safety
  ///
  /// The caller owns the pointed-to value and must keep it valid for every
  /// runtime callback or query that may access it.
  pub unsafe fn user_data_raw(mut self, user_data: *mut c_void) -> Self {
    self.user_data = user_data;
    self
  }

  pub fn resource_fetcher(mut self, fetcher: impl ResourceFetcher) -> Result<Self> {
    self.resource_fetcher = Some(GenericResourceFetcher::new(self.env, fetcher)?);
    Ok(self)
  }

  pub fn lynx_group(mut self, group: LynxGroup) -> Self {
    self.lynx_group = Some(group);
    self
  }

  /// Registers a native module on this view builder.
  ///
  /// # Safety
  ///
  /// `creator` and `opaque` must obey the native module ABI expected by the
  /// loaded `libLynx`. They must remain valid for at least as long as the
  /// created view can instantiate the module.
  pub unsafe fn register_native_module_raw(
    mut self,
    name: &str,
    creator: sys::napi_module_creator,
    opaque: *mut c_void,
  ) -> Result<Self> {
    self.native_modules.push(RawNativeModule {
      name: c_string(name, "native_module_name")?,
      creator,
      opaque,
    });
    Ok(self)
  }

  /// Registers an extension module on this view builder.
  ///
  /// # Safety
  ///
  /// `creator` and `opaque` must obey the extension module ABI expected by
  /// the loaded `libLynx`. They must remain valid for at least as long as the
  /// created view can instantiate the module.
  pub unsafe fn register_extension_module_raw(
    mut self,
    name: &str,
    creator: sys::extension_module_creator,
    is_lazy_create: bool,
    opaque: *mut c_void,
  ) -> Result<Self> {
    self.extension_modules.push(RawExtensionModule {
      name: c_string(name, "extension_module_name")?,
      creator,
      is_lazy_create,
      opaque,
    });
    Ok(self)
  }

  /// Registers an instance-level native view factory on this view builder.
  ///
  /// # Safety
  ///
  /// `creator` and `opaque` must obey the native-view ABI expected by the
  /// loaded runtime and remain valid while the created view may invoke them.
  pub unsafe fn register_native_view_raw(
    mut self,
    name: &str,
    creator: sys::lynx_native_view_creator,
    opaque: *mut c_void,
  ) -> Result<Self> {
    self.native_views.push(RawNativeView {
      name: c_string(name, "native_view_name")?,
      creator,
      opaque,
    });
    Ok(self)
  }

  pub fn build(self) -> Result<LynxView> {
    let sys = self.env.sys().clone();
    let builder = unsafe { (sys.lynx_view_builder_create)() };
    if builder.is_null() {
      return Err(Error::NullPointer {
        operation: "create view builder",
      });
    }
    let builder_guard = BuilderGuard {
      sys: sys.clone(),
      raw: builder,
    };

    unsafe {
      (sys.lynx_view_builder_set_screen_size)(
        builder,
        &self.width,
        &self.height,
        &self.pixel_ratio,
      );
      let origin = 0.0;
      (sys.lynx_view_builder_set_frame)(builder, &origin, &origin, &self.width, &self.height);
      (sys.lynx_view_builder_set_font_scale)(builder, &self.font_scale);
      (sys.lynx_view_builder_set_enable_js_runtime)(builder, self.enable_js_runtime);
      if let Some(path) = &self.icu_data_path {
        (sys.lynx_view_builder_set_icu_data_path)(builder, path.as_ptr());
      }
      if let Some(group) = &self.lynx_group {
        (sys.lynx_view_builder_set_lynx_group)(builder, group.raw());
      }
      (sys.lynx_view_builder_set_windowless_renderer)(builder, self.renderer.raw());
      if let Some(fetcher) = &self.resource_fetcher {
        (sys.lynx_view_builder_set_generic_resource_fetcher)(builder, fetcher.raw());
      }
      for module in &self.native_modules {
        (sys.lynx_view_builder_register_native_module)(
          builder,
          module.name.as_ptr(),
          Some(module.creator),
          module.opaque,
        );
      }
      for module in &self.extension_modules {
        (sys.lynx_view_builder_register_extension_module)(
          builder,
          module.name.as_ptr(),
          Some(module.creator),
          module.is_lazy_create,
          module.opaque,
        );
      }
      for native_view in &self.native_views {
        (sys.lynx_view_builder_register_native_view)(
          builder,
          native_view.name.as_ptr(),
          Some(native_view.creator),
          native_view.opaque,
        );
      }
    }

    let raw = unsafe { (sys.lynx_view_create)(builder, self.user_data) };
    drop(builder_guard);
    if raw.is_null() {
      return Err(Error::NullPointer {
        operation: "create Lynx view",
      });
    }

    Ok(LynxView {
      env: self.env,
      raw,
      renderer: self.renderer,
      _resource_fetcher: self.resource_fetcher,
      _lynx_group: self.lynx_group,
    })
  }
}

struct BuilderGuard {
  sys: Arc<sys::LoadedLibrary>,
  raw: *mut sys::lynx_view_builder_t,
}

impl Drop for BuilderGuard {
  fn drop(&mut self) {
    if !self.raw.is_null() {
      unsafe {
        (self.sys.lynx_view_builder_release)(self.raw);
      }
      self.raw = ptr::null_mut();
    }
  }
}

/// An owned Lynx view bound to its native owner thread.
pub struct LynxView {
  env: &'static LynxEnv,
  raw: *mut sys::lynx_view_t,
  renderer: WindowlessRenderer,
  _resource_fetcher: Option<GenericResourceFetcher>,
  _lynx_group: Option<LynxGroup>,
}

impl LynxView {
  pub fn builder(env: &'static LynxEnv, renderer: WindowlessRenderer) -> HeadlessViewBuilder {
    HeadlessViewBuilder::new(env, renderer)
  }

  pub fn renderer(&self) -> &WindowlessRenderer {
    &self.renderer
  }

  pub fn user_data_raw(&self) -> *mut c_void {
    unsafe { (self.env.sys().lynx_view_get_user_data)(self.raw) }
  }

  pub fn devtool_target(&self) -> Result<Option<DevtoolTarget>> {
    let get_target = require_runtime_api(
      self.env.sys().lynx_view_get_devtool_target,
      "lynx_view_get_devtool_target",
    )?;
    let mut target = sys::lynx_devtool_target_t {
      session_id: 0,
      url: ptr::null(),
    };
    let available = unsafe { get_target(self.raw, &mut target) };
    Ok(available.then(|| DevtoolTarget {
      session_id: target.session_id,
      url: unsafe { c_str_to_string(target.url) },
      _not_sync: PhantomData,
    }))
  }

  pub fn generic_resource_fetcher(&self) -> Option<GenericResourceFetcher> {
    let sys = self.env.sys().clone();
    let raw = unsafe { (sys.lynx_view_get_generic_resource_fetcher)(self.raw) };
    (!raw.is_null()).then(|| unsafe { GenericResourceFetcher::from_owned_raw(sys, raw) })
  }

  /// Adds a raw view client to receive Lynx lifecycle callbacks.
  ///
  /// # Safety
  ///
  /// `client` must be a valid `lynx_view_client_t` created for the same loaded
  /// runtime and must outlive its registration on this view.
  pub unsafe fn add_client_raw(&self, client: *mut sys::lynx_view_client_t) {
    (self.env.sys().lynx_view_add_client)(self.raw, client);
  }

  /// Removes a raw view client previously registered on this view.
  ///
  /// # Safety
  ///
  /// `client` must be a valid `lynx_view_client_t` that was previously added
  /// to this view and has not been released.
  pub unsafe fn remove_client_raw(&self, client: *mut sys::lynx_view_client_t) {
    (self.env.sys().lynx_view_remove_client)(self.raw, client);
  }

  /// Registers a runtime lifecycle observer on this view.
  ///
  /// # Safety
  ///
  /// `observer` must be valid for the loaded runtime and obey the ownership and
  /// callback-lifetime contract of `lynx_runtime_lifecycle_observer_t`.
  pub unsafe fn register_runtime_lifecycle_observer_raw(
    &self,
    observer: *mut sys::lynx_runtime_lifecycle_observer_t,
  ) {
    (self.env.sys().lynx_view_register_runtime_lifecycle_observer)(self.raw, observer);
  }

  /// Registers an instance-level native view factory on this view.
  ///
  /// # Safety
  ///
  /// `creator` and `opaque` must obey the native-view ABI expected by the
  /// loaded runtime and remain valid while this view may invoke them.
  pub unsafe fn register_native_view_raw(
    &self,
    name: &str,
    creator: sys::lynx_native_view_creator,
    opaque: *mut c_void,
  ) -> Result<()> {
    let name = c_string(name, "native_view_name")?;
    (self.env.sys().lynx_view_register_native_view)(self.raw, name.as_ptr(), Some(creator), opaque);
    Ok(())
  }

  /// Registers or clears the runtime-specific input method editor handler.
  ///
  /// # Safety
  ///
  /// Non-null `handler` and `opaque` pointers must follow the loaded runtime's
  /// IME contract and remain valid until the handler is cleared.
  pub unsafe fn register_ime_handler_raw(&self, handler: *mut c_void, opaque: *mut c_void) {
    (self.env.sys().lynx_view_register_ime_handler)(self.raw, handler, opaque);
  }

  /// Sets the custom vsync monitor used by this view.
  ///
  /// # Safety
  ///
  /// `monitor` must be a valid runtime-owned `lynx_vsync_monitor_t` with a
  /// lifetime covering every request made by this view.
  pub unsafe fn set_custom_vsync_monitor_raw(&self, monitor: *mut sys::lynx_vsync_monitor_t) {
    (self.env.sys().lynx_view_set_custom_vsync_monitor)(self.raw, monitor);
  }

  pub fn load_template_from_url(&self, url: &str, initial_data_json: Option<&str>) -> Result<()> {
    self.load_template(url, None, initial_data_json, None)
  }

  pub fn load_template_from_url_with_global_props(
    &self,
    url: &str,
    initial_data_json: Option<&str>,
    global_props_json: Option<&str>,
  ) -> Result<()> {
    self.load_template(url, None, initial_data_json, global_props_json)
  }

  pub fn load_template_bytes(
    &self,
    url: &str,
    bytes: &[u8],
    initial_data_json: Option<&str>,
  ) -> Result<()> {
    self.load_template(url, Some(bytes), initial_data_json, None)
  }

  pub fn load_template_bytes_with_global_props(
    &self,
    url: &str,
    bytes: &[u8],
    initial_data_json: Option<&str>,
    global_props_json: Option<&str>,
  ) -> Result<()> {
    self.load_template(url, Some(bytes), initial_data_json, global_props_json)
  }

  pub fn load_template_bundle_bytes(
    &self,
    url: &str,
    bytes: &[u8],
    initial_data_json: Option<&str>,
  ) -> Result<()> {
    self.load_template_bundle(url, bytes, initial_data_json, None)
  }

  pub fn load_template_bundle_bytes_with_global_props(
    &self,
    url: &str,
    bytes: &[u8],
    initial_data_json: Option<&str>,
    global_props_json: Option<&str>,
  ) -> Result<()> {
    self.load_template_bundle(url, bytes, initial_data_json, global_props_json)
  }

  /// Loads an experimental LynxML source document.
  pub fn load_lynx_ml(
    &self,
    source: &str,
    url: &str,
    initial_data_json: Option<&str>,
  ) -> Result<()> {
    let source = c_string(source, "lynx_ml_source")?;
    let url = c_string(url, "lynx_ml_url")?;
    let load_lynx_ml = require_runtime_api(
      self.env.sys().lynx_view_load_lynx_ml,
      "lynx_view_load_lynx_ml",
    )?;
    let initial_data = match initial_data_json {
      Some(json) => Some(TemplateData::from_json(self.env.sys().clone(), json)?),
      None => None,
    };
    unsafe {
      load_lynx_ml(
        self.raw,
        source.as_ptr(),
        url.as_ptr(),
        initial_data
          .as_ref()
          .map(|data| data.raw)
          .unwrap_or(ptr::null_mut()),
      );
    }
    Ok(())
  }

  pub fn load_template(
    &self,
    url: &str,
    bytes: Option<&[u8]>,
    initial_data_json: Option<&str>,
    global_props_json: Option<&str>,
  ) -> Result<()> {
    let sys = self.env.sys().clone();
    let meta = LoadMeta::new(sys.clone())?;
    let url = c_string(url, "template_url")?;
    let binary_data = bytes.map(CByteBuffer::copy_from_slice);
    unsafe {
      (sys.lynx_load_meta_set_url)(meta.raw, url.as_ptr());
      if let Some(binary_data) = binary_data {
        let (ptr, len, dtor, opaque) = binary_data.into_ffi();
        (sys.lynx_load_meta_set_binary_data)(meta.raw, ptr, len, dtor, opaque);
      }
    }
    let initial_data = match initial_data_json {
      Some(json) => Some(TemplateData::from_json(sys.clone(), json)?),
      None => None,
    };
    let global_props = match global_props_json {
      Some(json) => Some(TemplateData::from_json(sys.clone(), json)?),
      None => None,
    };
    unsafe {
      if let Some(data) = &initial_data {
        (sys.lynx_load_meta_set_initial_data)(meta.raw, data.raw);
      }
      if let Some(data) = &global_props {
        (sys.lynx_load_meta_set_global_props)(meta.raw, data.raw);
      }
      (sys.lynx_view_load_template)(self.raw, meta.raw);
    }
    Ok(())
  }

  fn load_template_bundle(
    &self,
    url: &str,
    bytes: &[u8],
    initial_data_json: Option<&str>,
    global_props_json: Option<&str>,
  ) -> Result<()> {
    let sys = self.env.sys().clone();
    let meta = LoadMeta::new(sys.clone())?;
    let url = c_string(url, "template_url")?;
    let template_bundle = TemplateBundle::from_bytes(sys.clone(), bytes)?;
    unsafe {
      (sys.lynx_load_meta_set_url)(meta.raw, url.as_ptr());
      (sys.lynx_load_meta_set_template_bundle)(meta.raw, template_bundle.raw);
    }
    let initial_data = match initial_data_json {
      Some(json) => Some(TemplateData::from_json(sys.clone(), json)?),
      None => None,
    };
    let global_props = match global_props_json {
      Some(json) => Some(TemplateData::from_json(sys.clone(), json)?),
      None => None,
    };
    unsafe {
      if let Some(data) = &initial_data {
        (sys.lynx_load_meta_set_initial_data)(meta.raw, data.raw);
      }
      if let Some(data) = &global_props {
        (sys.lynx_load_meta_set_global_props)(meta.raw, data.raw);
      }
      (sys.lynx_view_load_template)(self.raw, meta.raw);
    }
    Ok(())
  }

  pub fn update_data_json(&self, data_json: &str, global_props_json: Option<&str>) -> Result<()> {
    let sys = self.env.sys().clone();
    let meta = UpdateMeta::new(sys.clone())?;
    let data = TemplateData::from_json(sys.clone(), data_json)?;
    let global_props = match global_props_json {
      Some(json) => Some(TemplateData::from_json(sys.clone(), json)?),
      None => None,
    };
    unsafe {
      (sys.lynx_update_meta_set_update_data)(meta.raw, data.raw);
      if let Some(data) = &global_props {
        (sys.lynx_update_meta_set_global_props)(meta.raw, data.raw);
      }
      (sys.lynx_view_update_data)(self.raw, meta.raw);
    }
    Ok(())
  }

  pub fn reload_template(
    &self,
    data_json: Option<&str>,
    global_props_json: Option<&str>,
  ) -> Result<()> {
    let sys = self.env.sys().clone();
    let data = match data_json {
      Some(json) => Some(TemplateData::from_json(sys.clone(), json)?),
      None => None,
    };
    let global_props = match global_props_json {
      Some(json) => Some(TemplateData::from_json(sys.clone(), json)?),
      None => None,
    };
    unsafe {
      (sys.lynx_view_reload_template)(
        self.raw,
        data
          .as_ref()
          .map(|data| data.raw)
          .unwrap_or(ptr::null_mut()),
        global_props
          .as_ref()
          .map(|data| data.raw)
          .unwrap_or(ptr::null_mut()),
      );
    }
    Ok(())
  }

  pub fn send_global_event(&self, name: &str, json: &str) -> Result<()> {
    let name = c_string(name, "global_event_name")?;
    let json = c_string(json, "global_event_json")?;
    unsafe {
      (self.env.sys().lynx_view_send_global_event)(self.raw, name.as_ptr(), json.as_ptr());
    }
    Ok(())
  }

  pub fn inject_bubble_event(&self, params: &str) -> Result<()> {
    let params = c_string(params, "bubble_event_params")?;
    unsafe {
      (self.env.sys().lynx_view_inject_bubble_event)(self.raw, params.as_ptr());
    }
    Ok(())
  }

  pub fn send_touch_event(&self, name: &str, id: i32) -> Result<()> {
    self.send_touch_event_with_coordinates(name, TouchEvent::new(id))
  }

  pub fn send_touch_event_with_coordinates(&self, name: &str, event: TouchEvent) -> Result<()> {
    let name = c_string(name, "touch_event_name")?;
    unsafe {
      (self.env.sys().lynx_view_send_touch_event)(
        self.raw,
        name.as_ptr(),
        event.id,
        event.x,
        event.y,
        event.client_x,
        event.client_y,
        event.page_x,
        event.page_y,
      );
    }
    Ok(())
  }

  pub fn get_node_for_location(&self, x: i32, y: i32) -> i32 {
    unsafe { (self.env.sys().lynx_view_get_node_for_location)(self.raw, x, y) }
  }

  pub fn emulate_mouse_event(
    &self,
    event_name: &str,
    x: f32,
    y: f32,
    delta_x: f32,
    delta_y: f32,
  ) -> Result<()> {
    let event_name = c_string(event_name, "mouse_event_name")?;
    unsafe {
      (self.env.sys().lynx_view_emulate_mouse_event)(
        self.raw,
        event_name.as_ptr(),
        x,
        y,
        delta_x,
        delta_y,
      );
    }
    Ok(())
  }

  /// Sets or clears the devtool touch-event simulation proxy.
  ///
  /// # Safety
  ///
  /// A non-null callback must use the exact Lynx C ABI. `context` and every
  /// value it references must remain valid until the callback is cleared or
  /// the view is released, and the callback must not unwind across the FFI.
  pub unsafe fn set_event_simulation_proxy_raw(
    &self,
    callback: Option<sys::lynx_emulate_touch_fn>,
    context: *mut c_void,
  ) {
    (self.env.sys().lynx_view_set_event_simulation_proxy)(self.raw, callback, context);
  }

  /// Sets or clears all devtool event-simulation callbacks.
  ///
  /// # Safety
  ///
  /// Every non-null callback must use the exact Lynx C ABI. `context` and every
  /// value it references must remain valid until the callbacks are cleared or
  /// the view is released, and callbacks must not unwind across the FFI.
  pub unsafe fn set_event_simulation_callbacks_raw(
    &self,
    emulate_touch_callback: Option<sys::lynx_emulate_touch_fn>,
    focus_callback: Option<sys::lynx_focus_fn>,
    insert_text_callback: Option<sys::lynx_insert_text_fn>,
    context: *mut c_void,
  ) -> Result<()> {
    let set_callbacks = require_runtime_api(
      self.env.sys().lynx_view_set_event_simulation_callbacks,
      "lynx_view_set_event_simulation_callbacks",
    )?;
    set_callbacks(
      self.raw,
      emulate_touch_callback,
      focus_callback,
      insert_text_callback,
      context,
    );
    Ok(())
  }

  pub fn update_screen_metrics(&self, width: f32, height: f32, pixel_ratio: f32) {
    unsafe {
      (self.env.sys().lynx_view_update_screen_metrics)(self.raw, &width, &height, &pixel_ratio);
    }
  }

  pub fn set_frame(&self, x: f32, y: f32, width: f32, height: f32) {
    unsafe {
      (self.env.sys().lynx_view_set_frame)(self.raw, &x, &y, &width, &height);
    }
  }

  pub fn set_font_scale(&self, font_scale: f32) {
    unsafe {
      (self.env.sys().lynx_view_set_font_scale)(self.raw, &font_scale);
    }
  }

  pub fn enter_foreground(&self) {
    unsafe {
      (self.env.sys().lynx_view_enter_foreground)(self.raw);
    }
  }

  pub fn enter_background(&self) {
    unsafe {
      (self.env.sys().lynx_view_enter_background)(self.raw);
    }
  }
}

impl Drop for LynxView {
  fn drop(&mut self) {
    if !self.raw.is_null() {
      unsafe {
        (self.env.sys().lynx_view_release)(self.raw);
      }
      self.raw = ptr::null_mut();
    }
  }
}

fn require_runtime_api<T: Copy>(api: Option<T>, symbol: &'static str) -> Result<T> {
  api.ok_or(Error::UnsupportedRuntimeApi { symbol })
}

struct TemplateData {
  sys: Arc<sys::LoadedLibrary>,
  raw: *mut sys::lynx_template_data_t,
}

// SAFETY: `TemplateData` uniquely owns its native handle and may transfer that
// ownership between threads. The raw pointer keeps shared access disabled.
unsafe impl Send for TemplateData {}

impl TemplateData {
  fn from_json(sys: Arc<sys::LoadedLibrary>, json: &str) -> Result<Self> {
    let json = c_string(json, "template_data_json")?;
    let raw = unsafe { (sys.lynx_template_data_create_from_json)(json.as_ptr()) };
    if raw.is_null() {
      return Err(Error::NullPointer {
        operation: "create template data",
      });
    }
    Ok(Self { sys, raw })
  }
}

impl Drop for TemplateData {
  fn drop(&mut self) {
    if !self.raw.is_null() {
      unsafe {
        (self.sys.lynx_template_data_release)(self.raw);
      }
      self.raw = ptr::null_mut();
    }
  }
}

struct TemplateBundle {
  sys: Arc<sys::LoadedLibrary>,
  raw: *mut sys::lynx_template_bundle_t,
}

impl TemplateBundle {
  fn from_bytes(sys: Arc<sys::LoadedLibrary>, bytes: &[u8]) -> Result<Self> {
    let buffer = CByteBuffer::copy_from_slice(bytes);
    let (ptr, len, dtor, opaque) = buffer.into_ffi();
    let raw = unsafe { (sys.lynx_template_bundle_create)(ptr, len, dtor, opaque) };
    if raw.is_null() {
      return Err(Error::NullPointer {
        operation: "create template bundle",
      });
    }
    let bundle = Self { sys, raw };
    if unsafe { (bundle.sys.lynx_template_bundle_is_valid)(bundle.raw) } == 0 {
      let message = unsafe {
        c_str_to_string((bundle.sys.lynx_template_bundle_get_error_message)(
          bundle.raw,
        ))
      };
      return Err(Error::Message(format!(
        "failed to decode template bundle: {message}"
      )));
    }
    Ok(bundle)
  }
}

impl Drop for TemplateBundle {
  fn drop(&mut self) {
    if !self.raw.is_null() {
      unsafe {
        (self.sys.lynx_template_bundle_release)(self.raw);
      }
      self.raw = ptr::null_mut();
    }
  }
}

struct LoadMeta {
  sys: Arc<sys::LoadedLibrary>,
  raw: *mut sys::lynx_load_meta_t,
}

// SAFETY: `LoadMeta` uniquely owns its native handle. It is movable but not
// shareable between threads.
unsafe impl Send for LoadMeta {}

impl LoadMeta {
  fn new(sys: Arc<sys::LoadedLibrary>) -> Result<Self> {
    let raw = unsafe { (sys.lynx_load_meta_create)() };
    if raw.is_null() {
      return Err(Error::NullPointer {
        operation: "create load meta",
      });
    }
    Ok(Self { sys, raw })
  }
}

impl Drop for LoadMeta {
  fn drop(&mut self) {
    if !self.raw.is_null() {
      unsafe {
        (self.sys.lynx_load_meta_release)(self.raw);
      }
      self.raw = ptr::null_mut();
    }
  }
}

struct UpdateMeta {
  sys: Arc<sys::LoadedLibrary>,
  raw: *mut sys::lynx_update_meta_t,
}

// SAFETY: `UpdateMeta` uniquely owns its native handle. It is movable but not
// shareable between threads.
unsafe impl Send for UpdateMeta {}

impl UpdateMeta {
  fn new(sys: Arc<sys::LoadedLibrary>) -> Result<Self> {
    let raw = unsafe { (sys.lynx_update_meta_create)() };
    if raw.is_null() {
      return Err(Error::NullPointer {
        operation: "create update meta",
      });
    }
    Ok(Self { sys, raw })
  }
}

impl Drop for UpdateMeta {
  fn drop(&mut self) {
    if !self.raw.is_null() {
      unsafe {
        (self.sys.lynx_update_meta_release)(self.raw);
      }
      self.raw = ptr::null_mut();
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  static_assertions::assert_impl_all!(DevtoolTarget: Send);
  static_assertions::assert_not_impl_any!(DevtoolTarget: Sync);
  static_assertions::assert_impl_all!(HeadlessViewBuilder: Send);
  static_assertions::assert_not_impl_any!(HeadlessViewBuilder: Sync);
  static_assertions::assert_impl_all!(LoadMeta: Send);
  static_assertions::assert_not_impl_any!(LoadMeta: Sync);
  static_assertions::assert_impl_all!(TemplateData: Send);
  static_assertions::assert_not_impl_any!(TemplateData: Sync);
  static_assertions::assert_impl_all!(UpdateMeta: Send);
  static_assertions::assert_not_impl_any!(UpdateMeta: Sync);
  static_assertions::assert_not_impl_any!(LynxView: Send, Sync);
}
