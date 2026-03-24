// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * H-Bundle Demo entry — tests the preloader pipeline without the Vue template
 * compiler.  The component uses h() via an options-API render() function so
 * only the SFC pre-loader and runtime plumbing are exercised.
 *
 * Verify via DevTool → Runtime_listConsole:
 *   - "[vue-mt] SET_WORKLET_EVENT id=… type=bindEvent name=tap ctx={_wkltId:'…:onTap',…}"
 *   - "[vue-mt] SET_MT_REF id=… refImpl=…"
 */

import { createApp } from '@lynx-js/vue-runtime';

import HBundleDemo from './HBundleDemo.vue';

const app = createApp(HBundleDemo);
app.mount();
