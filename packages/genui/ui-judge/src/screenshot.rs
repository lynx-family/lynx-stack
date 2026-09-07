// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

//! Data URLs for the runner's original BMP frames.

use base64::prelude::{Engine, BASE64_STANDARD};

pub(crate) fn bmp_data_url(bmp: &[u8]) -> String {
  format!("data:image/bmp;base64,{}", BASE64_STANDARD.encode(bmp))
}
