// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use js_sys::Function;
use wasm_bindgen::prelude::*;
use web_sys::{window, Document, Element};

pub mod cross_thread_handlers;
pub mod main_thread_apis;
pub mod main_thread_lynx;
pub mod utils;

// Re-export main functions
pub use main_thread_apis::*;
pub use main_thread_lynx::*;

#[wasm_bindgen]
extern "C" {
  #[wasm_bindgen(js_namespace = console)]
  fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
pub struct MainThreadAPIs {
  document: Document,
  root_dom: Option<Element>,
  window: web_sys::Window,
}

#[wasm_bindgen]
impl MainThreadAPIs {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Result<MainThreadAPIs, JsValue> {
    let window = window().ok_or("No window object")?;
    let document = window.document().ok_or("No document object")?;

    Ok(MainThreadAPIs {
      document,
      root_dom: None,
      window,
    })
  }

  #[wasm_bindgen]
  pub fn set_root_dom(&mut self, element: &Element) {
    self.root_dom = Some(element.clone());
  }

  #[wasm_bindgen]
  pub fn get_window(&self) -> web_sys::Window {
    self.window.clone()
  }

  #[wasm_bindgen]
  pub fn get_document(&self) -> Document {
    self.document.clone()
  }

  #[wasm_bindgen]
  pub fn request_animation_frame(&self, callback: &Function) -> Result<i32, JsValue> {
    self.window.request_animation_frame(callback)
  }

  #[wasm_bindgen]
  pub fn cancel_animation_frame(&self, handle: i32) {
    let _ = self.window.cancel_animation_frame(handle);
  }
}

// Initialize the module
#[wasm_bindgen(start)]
pub fn init() {
  console_log!("web-mainthread-apis Rust module initialized");
}
