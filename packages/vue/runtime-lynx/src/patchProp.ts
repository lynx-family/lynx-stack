// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Property patching for the Vue custom renderer
 * 
 * This file provides the implementation of property patching using Lynx's Element PAPI.
 */

import type { LynxElement } from './nodeOps.js';

// Get the Lynx Element API
const getLynxElementApi = (): any | null => {
  if (typeof globalThis === 'undefined' || !(globalThis as any).__LYNX_ELEMENT_API__) {
    return null;
  }
  
  return (globalThis as any).__LYNX_ELEMENT_API__;
};

const api = getLynxElementApi();

// Event handler cache to properly remove event listeners
const eventHandlerCache = new WeakMap<LynxElement, Record<string, Function>>();

// Patch a class
function patchClass(el: LynxElement, value: string | null) {
  if (value == null) {
    if (api) {
      // Use Lynx's Element API directly if available
      api.__SetClasses(el, '');
    } else {
      el.removeAttribute('class');
    }
  } else {
    if (api) {
      // Use Lynx's Element API directly if available
      api.__SetClasses(el, value);
    } else {
      el.setAttribute('class', value);
    }
  }
}

// Patch a style
function patchStyle(el: LynxElement, _prev: any, next: any) {
  if (!next) {
    if (api) {
      // Use Lynx's Element API directly if available
      api.__SetInlineStyles(el, {});
    } else {
      el.removeAttribute('style');
    }
    return;
  }
  
  if (typeof next === 'string') {
    if (api) {
      // Use Lynx's Element API directly if available
      api.__SetInlineStyles(el, next);
    } else {
      el.setAttribute('style', next);
    }
    return;
  }
  
  // Handle object style
  if (api) {
    // Use Lynx's Element API directly if available
    api.__SetInlineStyles(el, next);
  } else {
    const style: Record<string, string> = {};
    
    for (const key in next) {
      style[key] = next[key];
    }
    
    el.setAttribute('style', style);
  }
}

// Patch an event listener
function patchEvent(
  el: LynxElement,
  name: string,
  prevValue: Function | null,
  nextValue: Function | null
) {
  // Get the event name (remove the 'on' prefix)
  const eventName = name.slice(2).toLowerCase();
  
  // Get or create the event handler cache for this element
  let handlers = eventHandlerCache.get(el);
  if (!handlers) {
    handlers = {};
    eventHandlerCache.set(el, handlers);
  }
  
  // Remove the previous handler if it exists
  if (prevValue) {
    if (handlers[eventName]) {
      if (api) {
        // Use Lynx's Element API directly if available
        api.__SetEvents(el, [{ type: 'bindEvent', name: eventName, function: null }]);
      } else {
        el.removeEventListener(eventName, handlers[eventName] as any);
      }
      delete handlers[eventName];
    }
  }
  
  // Add the new handler if it exists
  if (nextValue) {
    handlers[eventName] = nextValue;
    if (api) {
      // Use Lynx's Element API directly if available
      // Convert the function to a string identifier that Lynx can use
      const functionId = `vue_event_${eventName}_${Date.now()}`;
      
      // Register the function in the global scope for Lynx to call
      (globalThis as any)[functionId] = nextValue;
      
      api.__SetEvents(el, [{ type: 'bindEvent', name: eventName, function: functionId }]);
    } else {
      el.addEventListener(eventName, nextValue as any);
    }
  }
}

// Patch an attribute
function patchAttr(el: LynxElement, key: string, value: any) {
  if (value == null) {
    if (api) {
      // Use Lynx's Element API directly if available
      api.__SetAttribute(el, key, null);
    } else {
      el.removeAttribute(key);
    }
  } else {
    if (api) {
      // Use Lynx's Element API directly if available
      api.__SetAttribute(el, key, value);
    } else {
      el.setAttribute(key, value);
    }
  }
}

// Main patchProp function
export function patchProp(
  el: LynxElement,
  key: string,
  prevValue: any,
  nextValue: any
): void {
  // Handle special cases
  if (key === 'class') {
    patchClass(el, nextValue);
  } else if (key === 'style') {
    patchStyle(el, prevValue, nextValue);
  } else if (key.startsWith('on')) {
    patchEvent(el, key, prevValue, nextValue);
  } else {
    patchAttr(el, key, nextValue);
  }
} 
