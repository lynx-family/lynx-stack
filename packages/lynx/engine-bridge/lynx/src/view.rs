use crate::buffer::CByteBuffer;
use crate::group::LynxGroup;
use crate::resource::{GenericResourceFetcher, ResourceFetcher};
use crate::sys;
use crate::{c_str_to_string, c_string, Env, Error, Result, WindowlessRenderer};
use std::ffi::{c_void, CString};
use std::ptr;
use std::sync::Arc;

pub struct HeadlessViewBuilder {
  env: Env,
  renderer: WindowlessRenderer,
  width: f32,
  height: f32,
  pixel_ratio: f32,
  font_scale: f32,
  icu_data_path: Option<CString>,
  resource_fetcher: Option<GenericResourceFetcher>,
  lynx_group: Option<LynxGroup>,
  native_modules: Vec<RawNativeModule>,
  extension_modules: Vec<RawExtensionModule>,
}

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

impl HeadlessViewBuilder {
  pub fn new(env: Env, renderer: WindowlessRenderer) -> Self {
    Self {
      env,
      renderer,
      width: 0.0,
      height: 0.0,
      pixel_ratio: 1.0,
      font_scale: 1.0,
      icu_data_path: None,
      resource_fetcher: None,
      lynx_group: None,
      native_modules: Vec::new(),
      extension_modules: Vec::new(),
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

  pub fn icu_data_path(mut self, path: &str) -> Result<Self> {
    self.icu_data_path = Some(c_string(path, "icu_data_path")?);
    Ok(self)
  }

  pub fn resource_fetcher(mut self, fetcher: impl ResourceFetcher) -> Result<Self> {
    self.resource_fetcher = Some(GenericResourceFetcher::new(&self.env, fetcher)?);
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

  pub fn build(self) -> Result<HeadlessView> {
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
      (sys.lynx_rust_view_builder_set_screen_size)(
        builder,
        self.width,
        self.height,
        self.pixel_ratio,
      );
      (sys.lynx_rust_view_builder_set_frame)(builder, 0.0, 0.0, self.width, self.height);
      (sys.lynx_rust_view_builder_set_font_scale)(builder, self.font_scale);
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
    }

    let raw = unsafe { (sys.lynx_view_create)(builder, ptr::null_mut()) };
    drop(builder_guard);
    if raw.is_null() {
      return Err(Error::NullPointer {
        operation: "create headless view",
      });
    }
    let configured = unsafe {
      (sys.lynx_rust_view_set_use_texture_backend)(raw, self.renderer.use_texture_backend())
    };
    if !configured {
      unsafe {
        (sys.lynx_view_release)(raw);
      }
      return Err(Error::Message(
        "failed to configure headless texture backend".to_string(),
      ));
    }

    Ok(HeadlessView {
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

pub struct HeadlessView {
  env: Env,
  raw: *mut sys::lynx_view_t,
  renderer: WindowlessRenderer,
  _resource_fetcher: Option<GenericResourceFetcher>,
  _lynx_group: Option<LynxGroup>,
}

impl HeadlessView {
  pub fn builder(env: Env, renderer: WindowlessRenderer) -> HeadlessViewBuilder {
    HeadlessViewBuilder::new(env, renderer)
  }

  pub fn renderer(&self) -> &WindowlessRenderer {
    &self.renderer
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

  pub fn update_screen_metrics(&self, width: f32, height: f32, pixel_ratio: f32) {
    unsafe {
      (self.env.sys().lynx_rust_view_update_screen_metrics)(self.raw, width, height, pixel_ratio);
    }
  }

  pub fn set_frame(&self, x: f32, y: f32, width: f32, height: f32) {
    unsafe {
      (self.env.sys().lynx_rust_view_set_frame)(self.raw, x, y, width, height);
    }
  }

  pub fn set_font_scale(&self, font_scale: f32) {
    unsafe {
      (self.env.sys().lynx_rust_view_set_font_scale)(self.raw, font_scale);
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

impl Drop for HeadlessView {
  fn drop(&mut self) {
    if !self.raw.is_null() {
      unsafe {
        (self.env.sys().lynx_view_release)(self.raw);
      }
      self.raw = ptr::null_mut();
    }
  }
}

struct TemplateData {
  sys: Arc<sys::LoadedLibrary>,
  raw: *mut sys::lynx_template_data_t,
}

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
