// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This file provides a lazy loader for Vue in Lynx.
 */

// Import Vue from the actual Vue package
import * as Vue from 'vue';

// Import Lynx-specific Vue APIs
import { initLynxVue } from '../src/lynx/index.js';

// Initialize Lynx-specific Vue APIs
const LynxVue = initLynxVue(Vue);

// Register global Lynx Vue APIs
if (typeof window !== 'undefined') {
  window.__LYNX_VUE__ = LynxVue;
}

// Export Lynx-specific Vue APIs
export const createApp = LynxVue.createApp;
export const registerComponent = LynxVue.registerComponent;
export const getComponent = LynxVue.getComponent;

// Re-export Vue APIs
export * from 'vue';

// Export the default Vue instance with Lynx extensions
export default {
  ...Vue,
  createApp,
  registerComponent,
  getComponent,
}; 
