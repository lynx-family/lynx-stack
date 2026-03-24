// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Scroll Demo entry — MT worklet scroll events + BG reactivity.
 *
 * Tests:
 *   1. :main-thread-bindscroll → SET_WORKLET_EVENT op → MT worklet turns bg blue while scrolling
 *   2. :main-thread-bindscrollend → MT worklet turns bg green when settled
 *   3. @scroll (BG) → Vue reactivity updates scrollTop ref + debugColor computed
 *   4. :main-thread-ref → SET_MT_REF op → MT element reference for worklet targets
 */

import { createApp } from '@lynx-js/vue-runtime';

import ScrollDemo from './ScrollDemo.vue';

const app = createApp(ScrollDemo);
app.mount();
