// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * MTS Demo — Phase 2 SWC worklet transform demo.
 *
 * Tests the 'main thread' directive: the SWC worklet transform extracts
 * annotated functions into worklet context objects (BG) and
 * registerWorkletInternal calls (MT) automatically.
 */

import { createApp } from '@lynx-js/vue-runtime';

import MtsDemo from './MtsDemo.vue';

const app = createApp(MtsDemo);
app.mount();
