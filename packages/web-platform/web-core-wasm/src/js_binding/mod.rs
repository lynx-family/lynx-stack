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
