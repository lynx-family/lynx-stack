// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This file provides the Lynx API for Vue integration.
 */

import type { Component } from 'vue';

// Interface for Lynx API
interface LynxAPI {
  // Register a Vue app with Lynx
  registerApp: (container: Element) => void;
  
  // Register a Vue component with Lynx
  registerComponent: (name: string, component: Component) => void;
  
  // Create a Lynx element
  createElement: (type: string, props?: Record<string, any>, ...children: any[]) => Element;
  
  // Update a Lynx element
  updateElement: (element: Element, props: Record<string, any>) => void;
  
  // Remove a Lynx element
  removeElement: (element: Element) => void;
  
  // Get the parent of a Lynx element
  getParent: (element: Element) => Element | null;
  
  // Append a child to a Lynx element
  appendChild: (parent: Element, child: Element) => void;
  
  // Insert a child before another child
  insertBefore: (parent: Element, child: Element, beforeChild: Element) => void;
  
  // Remove a child from a Lynx element
  removeChild: (parent: Element, child: Element) => void;
}

// Create a mock Lynx API for development
const createMockLynxAPI = (): LynxAPI => {
  return {
    registerApp: (container) => {
      console.log('Lynx API: registerApp', container);
    },
    registerComponent: (name, component) => {
      console.log('Lynx API: registerComponent', name, component);
    },
    createElement: (type, props, ...children) => {
      console.log('Lynx API: createElement', type, props, children);
      return document.createElement(type);
    },
    updateElement: (element, props) => {
      console.log('Lynx API: updateElement', element, props);
    },
    removeElement: (element) => {
      console.log('Lynx API: removeElement', element);
    },
    getParent: (element) => {
      console.log('Lynx API: getParent', element);
      return element.parentElement;
    },
    appendChild: (parent, child) => {
      console.log('Lynx API: appendChild', parent, child);
      parent.appendChild(child);
    },
    insertBefore: (parent, child, beforeChild) => {
      console.log('Lynx API: insertBefore', parent, child, beforeChild);
      parent.insertBefore(child, beforeChild);
    },
    removeChild: (parent, child) => {
      console.log('Lynx API: removeChild', parent, child);
      parent.removeChild(child);
    },
  };
};

// Get the Lynx API from the global object or create a mock
export const lynxApi: LynxAPI = typeof window !== 'undefined' && (window as any).__LYNX_API__
  ? (window as any).__LYNX_API__
  : createMockLynxAPI(); 
