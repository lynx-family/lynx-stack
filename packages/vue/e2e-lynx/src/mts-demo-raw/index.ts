// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * MTS Demo (Raw) — raw worklet context objects, no SWC transform.
 *
 * Requires matching registerWorkletInternal() calls in entry-main.ts.
 * See mts-demo/ for the transform-based version using 'main thread' directive.
 */

import { createApp } from '@lynx-js/vue-runtime';

import MtsDemo from './MtsDemo.vue';

const app = createApp(MtsDemo);
app.mount();
