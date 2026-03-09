// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * MTS Draggable Demo (Raw) — raw worklet context objects, no SWC transform.
 *
 * Requires matching registerWorkletInternal() calls in entry-main.ts.
 * See mts-draggable/ for the transform-based version using 'main thread' directive.
 */

import { createApp } from '@lynx-js/vue-runtime';

import App from './App.vue';

const app = createApp(App);
app.mount();
