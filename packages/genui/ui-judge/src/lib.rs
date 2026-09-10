// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

mod capture;
mod headless;
#[cfg(feature = "server")]
mod ssrf;
mod visual;

#[cfg(feature = "server")]
pub mod server;

pub use headless::{capture_page, CapturePageError, CapturePageRequest};
pub use visual::{
  compare_uploaded_images as compare_images, ReferenceImageComparison, VisualEvaluationError,
  VisualEvaluationErrorCode,
};
