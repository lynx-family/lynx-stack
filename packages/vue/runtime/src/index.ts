// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This is the main entry point for the Vue runtime in Lynx.
 */

import * as Vue from 'vue';
import { initLynxVue } from './lynx/index.js';

// Re-export Vue APIs
export * from 'vue';

// Initialize Lynx-specific Vue APIs
const LynxVue = initLynxVue(Vue);

// Register global Lynx Vue APIs
declare global {
  interface Window {
    __LYNX_VUE__: any;
  }
}

if (typeof window !== 'undefined') {
  window.__LYNX_VUE__ = LynxVue;
}

// Export Lynx-specific Vue APIs
export const createApp: typeof LynxVue.createApp = LynxVue.createApp;
export const registerComponent: typeof LynxVue.registerComponent = LynxVue.registerComponent;
export const getComponent: typeof LynxVue.getComponent = LynxVue.getComponent;

// Export the default Vue instance with Lynx extensions
export default {
  createApp,
  registerComponent,
  getComponent,
}; 
