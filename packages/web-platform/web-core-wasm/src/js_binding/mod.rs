/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

/// JavaScript Bindings module.
///
/// This module defines the interface for interacting with JavaScript from Rust.
/// It uses `wasm-bindgen` to import JavaScript functions and objects.
///
/// Key components:
/// - `mts_js_binding`: Defines `RustMainthreadContextBinding`, which allows the Rust main thread context
///   to communicate with the JavaScript environment (e.g., publishing events, running worklets).
mod mts_js_binding;
pub(crate) use mts_js_binding::RustMainthreadContextBinding;
