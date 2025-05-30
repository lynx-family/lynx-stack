// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This file provides internal utilities for Vue integration with Lynx.
 */

import * as Vue from 'vue';
import { lynxApi } from './lynx-api.js';

// Re-export Vue internals
export * from 'vue';

/**
 * Register a Vue component with Lynx
 */
export function registerComponent(name: string, component: Vue.Component): void {
  lynxApi.registerComponent(name, component);
}

/**
 * Create a Lynx-specific Vue app
 */
export function createApp(
  rootComponent: Vue.Component,
  rootProps?: Record<string, unknown>,
): Vue.App {
  // Create the Vue app
  const app = Vue.createApp(rootComponent, rootProps);
  
  // Override the mount method to integrate with Lynx
  const originalMount = app.mount;
  app.mount = (rootContainer: string | Element) => {
    // If rootContainer is a string, find the element
    const container = typeof rootContainer === 'string'
      ? document.querySelector(rootContainer)
      : rootContainer;
    
    if (!container) {
      console.error(`Failed to mount app: container ${rootContainer} not found`);
      return {} as Vue.ComponentPublicInstance;
    }
    
    // Register the app with Lynx
    lynxApi.registerApp(container);
    
    // Call the original mount method
    return originalMount.call(app, container);
  };
  
  return app;
}

/**
 * Process Vue component options for Lynx integration
 */
export function processComponentOptions(options: Vue.ComponentOptions): Vue.ComponentOptions {
  // Add Lynx-specific options
  return {
    ...options,
    // Add any Lynx-specific processing here
  };
} 
