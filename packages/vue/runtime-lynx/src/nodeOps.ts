// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Node operations for the Vue custom renderer
 * 
 * This file provides the implementation of DOM-like operations using Lynx's Element PAPI.
 */

import { lynxApi } from './lynxApi.js';

// Type definitions for Lynx elements
export interface LynxElement {
  tagName: string;
  id: string;
  children: LynxElement[];
  parentElement: LynxElement | null;
  setAttribute: (name: string, value: any) => void;
  removeAttribute: (name: string) => void;
  addEventListener: (event: string, handler: (event: any) => void) => void;
  removeEventListener: (event: string, handler: (event: any) => void) => void;
  textContent: string;
}

export interface LynxText {
  nodeType: 3;
  textContent: string;
  parentElement: LynxElement | null;
}

export interface LynxComment {
  nodeType: 8;
  textContent: string;
  parentElement: LynxElement | null;
}

export type LynxNode = LynxElement | LynxText | LynxComment;

// Create a text container element for text nodes
const createTextContainer = (text: string): LynxElement | undefined => {
  const container = lynxApi.createElement('text');
  if (container) {
    container.textContent = text;
    return container;
  }
  return undefined;
};

// Node operations for the Vue custom renderer
export const nodeOps = {
  // Create element
  createElement(tag: string, _isSVG?: boolean, _is?: string): LynxElement {
    // Map Vue element types to Lynx element types if needed
    const lynxTag = mapVueTagToLynx(tag);
    return lynxApi.createElement(lynxTag);
  },

  // Create text node
  createText(text: string): LynxText {
    // In Lynx, we need to create a text element to hold text content
    // We'll use a special wrapper to maintain compatibility with Vue's expectations
    const textNode = {
      nodeType: 3,
      textContent: text,
      parentElement: null,
      // Store the actual Lynx element for when this text node is inserted
      _lynxElement: createTextContainer(text),
    } as LynxText & { _lynxElement: LynxElement };
    return textNode;
  },

  // Create comment
  createComment(text: string): LynxComment {
    // Lynx doesn't have native comment support, so we'll use a hidden element
    const commentNode = {
      nodeType: 8,
      textContent: text,
      parentElement: null,
      // Comments aren't rendered in Lynx
    } as LynxComment;
    return commentNode;
  },

  // Set text content
  setText(node: LynxText, text: string): void {
    node.textContent = text;
    // Update the actual Lynx element if it exists
    if ((node as any)._lynxElement) {
      (node as any)._lynxElement.textContent = text;
    }
  },

  // Set comment content
  setComment(node: LynxComment, text: string): void {
    node.textContent = text;
    // Comments aren't rendered in Lynx
  },

  // Set element text content
  setElementText(el: LynxElement, text: string): void {
    // Clear existing children
    while (el.children && el.children.length) {
      lynxApi.removeChild(el, el.children[0]!);
    }
    
    // If text is not empty, create a text element and append it
    if (text) {
      const textEl = createTextContainer(text);
      if (textEl) { // Add null check to fix TypeScript error
        // Use type assertion to satisfy TypeScript
        lynxApi.appendChild(el, textEl);
      }
    }
  },

  // Set static content
  setStaticContent(container: LynxElement, content: string, _anchor: LynxNode | null): LynxElement | null {
    // In Lynx, we can't directly set innerHTML, so we need to parse and create elements
    console.warn('setStaticContent is not fully supported in Lynx');
    this.setElementText(container, content);
    return container.children[0] ?? null;
  },

  // Insert element before another element
  insertBefore(parent: LynxElement, child: LynxNode, anchor: LynxNode | null): void {
    // Handle text and comment nodes
    const childElement = isTextOrComment(child) 
      ? (child as any)._lynxElement || createTextContainer((child as any).textContent)
      : child as LynxElement;
    
    // If it's a text node, store the Lynx element
    if (isTextNode(child) && !(child as any)._lynxElement) {
      (child as any)._lynxElement = childElement;
    }
    
    if (anchor) {
      const anchorElement = isTextOrComment(anchor)
        ? (anchor as any)._lynxElement
        : anchor as LynxElement;
        
      if (anchorElement) {
        lynxApi.insertBefore(parent, childElement, anchorElement);
      } else {
        lynxApi.appendChild(parent, childElement);
      }
    } else {
      lynxApi.appendChild(parent, childElement);
    }
  },

  // Insert element into parent (alias for insertBefore)
  insert(child: LynxNode, parent: LynxElement, anchor?: LynxNode | null): void {
    this.insertBefore(parent, child, anchor || null);
  },

  // Remove element
  remove(child: LynxNode): void {
    const childElement = isTextOrComment(child)
      ? (child as any)._lynxElement
      : child as LynxElement;
      
    if (childElement && childElement.parentElement) {
      lynxApi.removeChild(childElement.parentElement, childElement);
    }
  },

  // Append child
  appendChild(parent: LynxElement, child: LynxNode): void {
    this.insertBefore(parent, child, null);
  },

  // Get parent node
  parentNode(node: LynxNode): LynxElement | null {
    if (isTextOrComment(node)) {
      return (node as any)._lynxElement?.parentElement || null;
    }
    return (node as LynxElement).parentElement;
  },

  // Get next sibling
  nextSibling(node: LynxNode): LynxNode | null {
    const parent = this.parentNode(node);
    if (!parent) return null;
    
    const childElement = isTextOrComment(node)
      ? (node as any)._lynxElement
      : node as LynxElement;
      
    if (!childElement) return null;
    
    const index = parent.children.indexOf(childElement);
    if (index === -1 || index === parent.children.length - 1) return null;
    
    return parent.children[index + 1] || null;
  },

  // Set scope ID
  setScopeId(el: LynxElement, id: string): void {
    el.setAttribute('data-scope-id', id);
  },

  // Clone node (not fully supported in Lynx)
  cloneNode(node: LynxNode): LynxNode {
    console.warn('cloneNode is not fully supported in Lynx');
    
    if (isTextNode(node)) {
      return this.createText((node as LynxText).textContent);
    } else if (isCommentNode(node)) {
      return this.createComment((node as LynxComment).textContent);
    } else {
      // For elements, create a new element with the same tag
      const el = node as LynxElement;
      const clone = this.createElement(el.tagName);
      
      // Copy attributes (not fully implemented)
      // In a real implementation, we would need to copy all attributes
      
      return clone;
    }
  }
};

// Helper functions
function isTextNode(node: LynxNode): boolean {
  return (node as any).nodeType === 3;
}

function isCommentNode(node: LynxNode): boolean {
  return (node as any).nodeType === 8;
}

function isTextOrComment(node: LynxNode): boolean {
  return isTextNode(node) || isCommentNode(node);
}

// Map Vue element types to Lynx element types
function mapVueTagToLynx(tag: string): string {
  // Map common HTML elements to Lynx elements
  const tagMap: Record<string, string> = {
    'div': 'view',
    'span': 'text',
    'p': 'text',
    'h1': 'text',
    'h2': 'text',
    'h3': 'text',
    'h4': 'text',
    'h5': 'text',
    'h6': 'text',
    'img': 'image',
    'input': 'input',
    'button': 'button',
    'a': 'link',
    // Add more mappings as needed
  };
  
  return tagMap[tag.toLowerCase()] || tag;
}
