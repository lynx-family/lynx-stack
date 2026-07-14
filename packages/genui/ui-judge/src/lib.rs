// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

mod headless;
mod judge;
mod model;
mod visual;

#[cfg(feature = "server")]
pub mod server;

pub use headless::{judge_page, JudgePageRequest};
pub use judge::{UiJudgeError, UiJudgeResult};
