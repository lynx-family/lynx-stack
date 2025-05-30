// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This file provides the integration between Vue and Lynx.
 */

import type { App, Component, ComponentPublicInstance } from 'vue';
import { lynxApi } from '../lynx-api.js';

// Store for registered components
const componentRegistry = new Map<string, Component>();

/**
 * Initialize Lynx-specific Vue APIs
 */
export interface LynxVueAPI {
  createApp: (rootComponent: Component, rootProps?: Record<string, unknown>) => App;
  registerComponent: (name: string, component: Component) => void;
  getComponent: (name: string) => Component | undefined;
}

export function initLynxVue(Vue: any): LynxVueAPI {
  // Create a Lynx-specific createApp function
  const createApp = (rootComponent: Component, rootProps?: Record<string, unknown>): App => {
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
        return {} as ComponentPublicInstance;
      }
      
      // Register the app with Lynx
      lynxApi.registerApp(container);
      
      // Call the original mount method
      return originalMount.call(app, container);
    };
    
    return app;
  };
  
  // Function to register a Vue component with Lynx
  const registerComponent = (name: string, component: Component): void => {
    componentRegistry.set(name, component);
    lynxApi.registerComponent(name, component);
  };
  
  // Function to get a registered Vue component
  const getComponent = (name: string): Component | undefined => {
    return componentRegistry.get(name);
  };
  
  return {
    createApp,
    registerComponent,
    getComponent,
  };
} 
