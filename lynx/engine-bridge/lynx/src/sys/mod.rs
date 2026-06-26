#![allow(non_camel_case_types)]
#![allow(non_snake_case)]
#![allow(non_upper_case_globals)]

mod bindings;
mod loader;

pub use bindings::*;
pub use loader::{candidate_library_paths, library_filename, Error, LoadedLibrary, Result};
