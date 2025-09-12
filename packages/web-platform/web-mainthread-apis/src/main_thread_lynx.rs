// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use js_sys::Function;
use wasm_bindgen::prelude::*;
use web_sys::{window, Window};
use crate::create_main_thread_global_this::MainThreadRuntimeConfig;

#[wasm_bindgen]
pub struct MainThreadLynx {
  js_context: JsValue,
  global_props: JsValue,
  lynx_template: JsValue,
  callbacks: JsValue,
  window: Window,
}

#[wasm_bindgen]
impl MainThreadLynx {
  #[wasm_bindgen(constructor)]
  pub fn new(config: JsValue, _system_info: JsValue) -> Result<MainThreadLynx, JsValue> {
    let window = window().ok_or("No window object available")?;

    // Extract fields from config object
    let js_context = js_sys::Reflect::get(&config, &"jsContext".into()).unwrap_or(JsValue::NULL);
    let global_props =
      js_sys::Reflect::get(&config, &"globalProps".into()).unwrap_or(JsValue::NULL);
    let lynx_template =
      js_sys::Reflect::get(&config, &"lynxTemplate".into()).unwrap_or(JsValue::NULL);
    let callbacks = js_sys::Reflect::get(&config, &"callbacks".into()).unwrap_or(JsValue::NULL);

    Ok(MainThreadLynx {
      js_context,
      global_props,
      lynx_template,
      callbacks,
      window,
    })
  }

  #[wasm_bindgen]
  pub fn get_js_context(&self) -> JsValue {
    self.js_context.clone()
  }

  #[wasm_bindgen]
  pub fn request_animation_frame(&self, callback: &Function) -> Result<i32, JsValue> {
    self.window.request_animation_frame(callback)
  }

  #[wasm_bindgen]
  pub fn cancel_animation_frame(&self, handle: i32) {
    let _ = self.window.cancel_animation_frame(handle);
  }

  #[wasm_bindgen]
  pub fn get_global_props(&self) -> JsValue {
    self.global_props.clone()
  }

  #[wasm_bindgen]
  pub fn get_custom_section_sync(&self, key: &str) -> JsValue {
    // Extract custom sections from lynx_template
    let template = &self.lynx_template;

    // Try to access template.customSections[key]?.content
    if let Ok(custom_sections) = js_sys::Reflect::get(template, &"customSections".into()) {
      if let Ok(section) = js_sys::Reflect::get(&custom_sections, &key.into()) {
        if let Ok(content) = js_sys::Reflect::get(&section, &"content".into()) {
          return content;
        }
      }
    }

    JsValue::UNDEFINED
  }

  #[wasm_bindgen]
  pub fn mark_pipeline_timing(&self, timing_key: &str, pipeline_id: Option<String>) {
    // Call the markTiming callback from config.callbacks
    if let Ok(callbacks) = js_sys::Reflect::get(&self.callbacks, &"markTiming".into()) {
      if let Ok(mark_timing_fn) = callbacks.dyn_into::<Function>() {
        let args = js_sys::Array::new();
        args.push(&timing_key.into());
        if let Some(id) = pipeline_id {
          args.push(&id.into());
        }
        let _ = mark_timing_fn.apply(&JsValue::NULL, &args);
      }
    }
  }

  #[wasm_bindgen]
  pub fn get_system_info(&self) -> JsValue {
    // Return a simple system info object
    let system_info = js_sys::Object::new();
    js_sys::Reflect::set(&system_info, &"platform".into(), &"web".into()).ok();
    js_sys::Reflect::set(&system_info, &"version".into(), &"1.0.0".into()).ok();
    system_info.into()
  }

  #[wasm_bindgen]
  pub fn set_timeout(&self, callback: &Function, delay: i32) -> Result<i32, JsValue> {
    self
      .window
      .set_timeout_with_callback_and_timeout_and_arguments_0(callback, delay)
  }

  #[wasm_bindgen]
  pub fn clear_timeout(&self, handle: i32) {
    self.window.clear_timeout_with_handle(handle);
  }

  #[wasm_bindgen]
  pub fn set_interval(&self, callback: &Function, delay: i32) -> Result<i32, JsValue> {
    self
      .window
      .set_interval_with_callback_and_timeout_and_arguments_0(callback, delay)
  }

  #[wasm_bindgen]
  pub fn clear_interval(&self, handle: i32) {
    self.window.clear_interval_with_handle(handle);
  }
}

// Helper function to create MainThreadLynx (equivalent to the TypeScript function)
#[wasm_bindgen]
pub fn create_main_thread_lynx(
  config: JsValue,
  system_info: JsValue,
) -> Result<MainThreadLynx, JsValue> {
  MainThreadLynx::new(config, system_info)
}

// Implementation function that creates MainThreadLynx from config
pub fn create_main_thread_lynx_impl(config: &MainThreadRuntimeConfig) -> JsValue {
    let lynx = js_sys::Object::new();
    
    // Get window and document from config
    let window = window().unwrap();
    let document = config.document.clone();
    let performance = window.performance();
    
    // Request animation frame function
    let raf_window = window.clone();
    let request_animation_frame = Closure::wrap(Box::new(move |callback: Function| -> Result<i32, JsValue> {
        raf_window.request_animation_frame(&callback)
    }) as Box<dyn FnMut(Function) -> Result<i32, JsValue>>);
    
    // Cancel animation frame function
    let caf_window = window.clone();
    let cancel_animation_frame = Closure::wrap(Box::new(move |handle: i32| {
        let _ = caf_window.cancel_animation_frame(handle);
    }) as Box<dyn FnMut(i32)>);
    
    // Set timeout function
    let st_window = window.clone();
    let set_timeout = Closure::wrap(Box::new(move |callback: Function, delay: i32| -> Result<i32, JsValue> {
        st_window.set_timeout_with_callback_and_timeout_and_arguments_0(&callback, delay)
    }) as Box<dyn FnMut(Function, i32) -> Result<i32, JsValue>>);
    
    // Clear timeout function
    let ct_window = window.clone();
    let clear_timeout = Closure::wrap(Box::new(move |handle: i32| {
        ct_window.clear_timeout_with_handle(handle);
    }) as Box<dyn FnMut(i32)>);
    
    // Set interval function
    let si_window = window.clone();
    let set_interval = Closure::wrap(Box::new(move |callback: Function, delay: i32| -> Result<i32, JsValue> {
        si_window.set_interval_with_callback_and_timeout_and_arguments_0(&callback, delay)
    }) as Box<dyn FnMut(Function, i32) -> Result<i32, JsValue>>);
    
    // Clear interval function
    let ci_window = window.clone();
    let clear_interval = Closure::wrap(Box::new(move |handle: i32| {
        ci_window.clear_interval_with_handle(handle);
    }) as Box<dyn FnMut(i32)>);
    
    // Performance now function
    let perf_clone = performance.clone();
    let now = Closure::wrap(Box::new(move || -> f64 {
        if let Some(perf) = &perf_clone {
            perf.now()
        } else {
            js_sys::Date::now()
        }
    }) as Box<dyn FnMut() -> f64>);
    
    // Mark timing function
    let mark_perf = performance.clone();
    let mark_timing = Closure::wrap(Box::new(move |name: String| -> Result<(), JsValue> {
        if let Some(perf) = &mark_perf {
            perf.mark(&name)?;
        }
        Ok(())
    }) as Box<dyn FnMut(String) -> Result<(), JsValue>>);
    
    // Set all methods on the lynx object
    js_sys::Reflect::set(&lynx, &"requestAnimationFrame".into(), request_animation_frame.as_ref().unchecked_ref()).unwrap();
    js_sys::Reflect::set(&lynx, &"cancelAnimationFrame".into(), cancel_animation_frame.as_ref().unchecked_ref()).unwrap();
    js_sys::Reflect::set(&lynx, &"setTimeout".into(), set_timeout.as_ref().unchecked_ref()).unwrap();
    js_sys::Reflect::set(&lynx, &"clearTimeout".into(), clear_timeout.as_ref().unchecked_ref()).unwrap();
    js_sys::Reflect::set(&lynx, &"setInterval".into(), set_interval.as_ref().unchecked_ref()).unwrap();
    js_sys::Reflect::set(&lynx, &"clearInterval".into(), clear_interval.as_ref().unchecked_ref()).unwrap();
    js_sys::Reflect::set(&lynx, &"now".into(), now.as_ref().unchecked_ref()).unwrap();
    js_sys::Reflect::set(&lynx, &"markTiming".into(), mark_timing.as_ref().unchecked_ref()).unwrap();
    
    // Set document and window references
    js_sys::Reflect::set(&lynx, &"document".into(), &document).unwrap();
    js_sys::Reflect::set(&lynx, &"window".into(), &window).unwrap();
    
    // Keep closures alive
    request_animation_frame.forget();
    cancel_animation_frame.forget();
    set_timeout.forget();
    clear_timeout.forget();
    set_interval.forget();
    clear_interval.forget();
    now.forget();
    mark_timing.forget();
    
    lynx.into()
}
