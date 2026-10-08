// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { loadWorkletRuntime } from '../../../../runtime/lib/worklet-runtime/bindings/loadRuntime.js';

// MIXED test modules may load on the background thread. The test chunk loader
// initializes the main-thread runtime and restores the caller's thread.
loadWorkletRuntime();
