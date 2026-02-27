/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

/// Main Thread module.
///
/// This module contains the core logic for the main thread of the Lynx web platform.
/// It manages the state of the application, including elements, templates, and interactions with the DOM.
///
/// Key components:
/// - `main_thread_context`: Defines `MainThreadWasmContext`, the central struct holding the application state.
/// - `element_apis`: Contains APIs for manipulating elements, handling events, and managing styles.
pub(crate) mod element_apis;
pub(crate) mod main_thread_context;
pub mod style_manager;
