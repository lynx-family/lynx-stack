//! Raw Lynx C ABI bindings and dynamic symbol loading.
//!
//! This module is intentionally low level. Most embedders should use the safe
//! wrappers re-exported from the crate root. Use `sys` when you need direct
//! access to a loaded `libLynx_clay` symbol or a checked-in ABI type.

#![allow(non_camel_case_types)]
#![allow(non_snake_case)]
#![allow(non_upper_case_globals)]

mod bindings;
mod loader;

pub use bindings::*;
pub use loader::{candidate_library_paths, library_filename, Error, LoadedLibrary, Result};
