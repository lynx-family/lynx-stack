// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * MTS Draggable Demo — replicates React Lynx's main-thread-draggable example.
 *
 * Shows two boxes that track a scroll-view's scroll position:
 *   - Left box: updated via Main Thread (smooth, zero thread crossings)
 *   - Right box: updated via Background Thread (laggy, 2 thread crossings)
 *
 * Demonstrates the performance advantage of Main Thread Script for
 * gesture-driven animations.
 */

import { createApp } from '@lynx-js/vue-runtime';

import App from './App.vue';

const app = createApp(App);
app.mount();
