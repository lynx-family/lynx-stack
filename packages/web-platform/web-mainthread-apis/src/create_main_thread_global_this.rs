// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use wasm_bindgen::prelude::*;
use web_sys::{Document, Element};
use js_sys::Object;

// Configuration structure that matches the TypeScript interface
#[wasm_bindgen]
pub struct MainThreadRuntimeConfig {
    pub page_config: JsValue,
    pub global_props: JsValue,
    pub callbacks: JsValue,
    pub lynx_template: JsValue,
    pub browser_config: JsValue,
    pub tag_map: JsValue,
    pub root_dom: Element,
    pub js_context: JsValue,
    pub ssr_hydrate_info: Option<JsValue>,
    pub ssr_hooks: Option<JsValue>,
    pub mts_realm: JsValue,
    pub document: Document,
}

#[wasm_bindgen]
impl MainThreadRuntimeConfig {
    #[wasm_bindgen(constructor)]
    pub fn new(
        page_config: JsValue,
        global_props: JsValue,
        callbacks: JsValue,
        lynx_template: JsValue,
        browser_config: JsValue,
        tag_map: JsValue,
        root_dom: Element,
        js_context: JsValue,
        mts_realm: JsValue,
        document: Document,
    ) -> MainThreadRuntimeConfig {
        MainThreadRuntimeConfig {
            page_config,
            global_props,
            callbacks,
            lynx_template,
            browser_config,
            tag_map,
            root_dom,
            js_context,
            ssr_hydrate_info: None,
            ssr_hooks: None,
            mts_realm,
            document,
        }
    }

    #[wasm_bindgen(setter)]
    pub fn set_ssr_hydrate_info(&mut self, info: Option<JsValue>) {
        self.ssr_hydrate_info = info;
    }

    #[wasm_bindgen(setter)]
    pub fn set_ssr_hooks(&mut self, hooks: Option<JsValue>) {
        self.ssr_hooks = hooks;
    }
}

#[wasm_bindgen]
pub fn create_main_thread_global_this(config: &MainThreadRuntimeConfig) -> JsValue {
    let global_this = Object::new();
    
    // Add basic system info
    let system_info = Object::new();
    js_sys::Reflect::set(&system_info, &"platform".into(), &"web".into()).unwrap();
    js_sys::Reflect::set(&global_this, &"SystemInfo".into(), &system_info).unwrap();
    
    // Add global props
    js_sys::Reflect::set(&global_this, &"__globalProps".into(), &config.global_props).unwrap();
    
    // Add main thread Lynx API
    let lynx = crate::main_thread_lynx::create_main_thread_lynx_impl(config);
    js_sys::Reflect::set(&global_this, &"lynx".into(), &lynx).unwrap();
    
    global_this.into()
}