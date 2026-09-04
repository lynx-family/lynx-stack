// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Declarative effects capture worklets exported from this entry. Keep the
// entry in the main-thread chunk so those worklets are registered before the
// background thread dispatches an effect.
import '../animation/index.js';
