// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This file provides document-related utilities for Vue integration with Lynx.
 */

import { lynxApi } from './lynx-api.js';

/**
 * Create a Lynx element
 */
export function createElement(type: string, props?: Record<string, any>, ...children: any[]): Element {
  return lynxApi.createElement(type, props, ...children);
}

/**
 * Create a text node
 */
export function createTextNode(text: string): Text {
  // Use the browser's createTextNode for now
  return document.createTextNode(text);
}

/**
 * Create a comment node
 */
export function createComment(text: string): Comment {
  // Use the browser's createComment for now
  return document.createComment(text);
}

/**
 * Get the parent of an element
 */
export function getParentNode(node: Node): Node | null {
  if (node instanceof Element) {
    return lynxApi.getParent(node);
  }
  return node.parentNode;
}

/**
 * Insert a node before another node
 */
export function insertBefore(parentNode: Node, newNode: Node, referenceNode: Node | null): void {
  if (parentNode instanceof Element && newNode instanceof Element) {
    if (referenceNode instanceof Element) {
      lynxApi.insertBefore(parentNode, newNode, referenceNode);
    } else {
      lynxApi.appendChild(parentNode, newNode);
    }
  } else {
    parentNode.insertBefore(newNode, referenceNode);
  }
}

/**
 * Remove a child node
 */
export function removeChild(parentNode: Node, childNode: Node): void {
  if (parentNode instanceof Element && childNode instanceof Element) {
    lynxApi.removeChild(parentNode, childNode);
  } else {
    parentNode.removeChild(childNode);
  }
}

/**
 * Set an attribute on an element
 */
export function setAttribute(el: Element, key: string, value: any): void {
  if (value === null || value === undefined) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, String(value));
  }
}

/**
 * Set a property on an element
 */
export function setProperty(el: Element, key: string, value: any): void {
  (el as any)[key] = value;
}

/**
 * Set text content on a node
 */
export function setTextContent(node: Node, text: string): void {
  node.textContent = text;
} 
