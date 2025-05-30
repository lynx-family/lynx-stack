// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This file provides Hot Module Replacement (HMR) support for Vue in Lynx.
 */

import { createHotContext } from '@lynx-js/webpack-dev-transport/client';

// Store for registered components
const componentsCache = new Map();

// Create a Vue HMR handler
if (module.hot) {
  // Accept updates for Vue components
  module.hot.accept((err) => {
    if (err) {
      console.error('Error during Vue HMR:', err);
    }
  });

  // Create a hot context for Vue components
  const hotContext = createHotContext('vue');

  // Handle updates for Vue components
  hotContext.on('update', (data) => {
    const { id, component } = data;
    
    // Get the old component
    const oldComponent = componentsCache.get(id);
    
    if (oldComponent && component) {
      // Update the component
      console.log(`[HMR] Updating Vue component: ${id}`);
      
      // Store the new component
      componentsCache.set(id, component);
      
      // Trigger a reload if needed
      if (typeof window !== 'undefined' && window.__LYNX_VUE__) {
        // Register the updated component
        window.__LYNX_VUE__.registerComponent(id, component);
      }
    }
  });
}

/**
 * Register a Vue component for HMR
 */
export function registerComponentForHMR(id: string, component: any): void {
  // Store the component
  componentsCache.set(id, component);
  
  // Register with Lynx Vue
  if (typeof window !== 'undefined' && window.__LYNX_VUE__) {
    window.__LYNX_VUE__.registerComponent(id, component);
  }
}

/**
 * Create a Vue component with HMR support
 */
export function createComponent(id: string, componentFactory: () => any): any {
  // Create the component
  const component = componentFactory();
  
  // Register for HMR
  registerComponentForHMR(id, component);
  
  return component;
} 
