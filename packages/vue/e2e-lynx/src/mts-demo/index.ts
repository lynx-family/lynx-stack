// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * MTS Demo entry — Phase 1 Main Thread Script plumbing test.
 *
 * Tests:
 *   1. :main-thread-bindtap → SET_WORKLET_EVENT op → __AddEvent({type:'worklet'})
 *   2. :main-thread-bindscroll → same pipeline
 *   3. :main-thread-ref → SET_MT_REF op → MT element mapping
 *   4. Regular @tap events still work (no regression)
 *
 * Verify via DevTool → Runtime_listConsole:
 *   - "[vue-mt] SET_WORKLET_EVENT id=... type=bindEvent name=tap ctx=..."
 *   - "[vue-mt] SET_MT_REF id=... refImpl=..."
 */

import { createApp } from '@lynx-js/vue-runtime';

import MtsDemo from './MtsDemo.vue';

const app = createApp(MtsDemo);
app.mount();
