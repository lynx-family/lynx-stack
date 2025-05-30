// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This file provides type definitions for Vue in Lynx.
 */

import * as Vue from 'vue';

// Re-export Vue types
export * from 'vue';

// Lynx-specific extensions to Vue
declare module 'vue' {
  interface App {
    /**
     * Mount the app to a Lynx element
     */
    mount(rootContainer: string | Element): ComponentPublicInstance;
  }

  interface ComponentInternalInstance {
    /**
     * Lynx-specific instance properties
     */
    lynx?: {
      /**
       * The Lynx element associated with this component
       */
      element?: any;
      /**
       * The Lynx component ID
       */
      id?: string;
    };
  }

  interface ComponentCustomOptions {
    /**
     * Lynx-specific component options
     */
    lynx?: {
      /**
       * Whether this component should be rendered in the main thread
       */
      mainThread?: boolean;
      /**
       * Whether this component should be rendered in the background thread
       */
      backgroundThread?: boolean;
    };
  }
}

// Lynx-specific Vue APIs
export interface LynxVueAPI {
  /**
   * Create a Lynx-specific Vue app
   */
  createApp: typeof Vue.createApp;
  
  /**
   * Register a Vue component with Lynx
   */
  registerComponent: (name: string, component: Vue.Component) => void;
  
  /**
   * Get a registered Vue component
   */
  getComponent: (name: string) => Vue.Component | undefined;
}

// Declare global Lynx APIs
declare global {
  interface Window {
    /**
     * Lynx-specific Vue APIs
     */
    __LYNX_VUE__: LynxVueAPI;
  }
}

// Export the default Vue instance
export default Vue; 
