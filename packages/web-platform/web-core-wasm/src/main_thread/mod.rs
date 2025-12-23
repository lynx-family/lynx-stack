/// Main Thread module.
///
/// This module contains the core logic for the main thread of the Lynx web platform.
/// It manages the state of the application, including elements, templates, and interactions with the DOM.
///
/// Key components:
/// - `main_thread_context`: Defines `MainThreadWasmContext`, the central struct holding the application state.
/// - `element_apis`: Contains APIs for manipulating elements, handling events, and managing styles.
mod element_apis;
mod main_thread_context;
