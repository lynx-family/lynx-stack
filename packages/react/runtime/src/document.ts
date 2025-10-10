// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { BackgroundSnapshotInstance } from './backgroundSnapshot.js';
import { SnapshotInstance } from './snapshot.js';

/**
 * This module implements an Interface Adapter Pattern to integrate Preact's
 * rendering system with Lynx's custom Snapshot-based virtual DOM.
 *
 * It works by:
 * 1. Defining a minimal {@link Document}-like interface that Preact expects
 * 2. Implementing this interface to return our {@link Snapshot} instances
 * 3. Maintaining the same method signatures as the standard DOM API
 *
 * This allows Preact to build its virtual tree using our Snapshot system
 * without knowing it's not working with a real DOM.
 */

/**
 * Defines the minimal document interface that Preact expects, depending on
 * which thread is running.
 */
interface SnapshotDocumentAdapter {
  createElement(type: string): BackgroundSnapshotInstance | SnapshotInstance;
  createElementNS(ns: string | null, type: string): BackgroundSnapshotInstance | SnapshotInstance;
  createTextNode(text: string): BackgroundSnapshotInstance | SnapshotInstance;
}

const document: SnapshotDocumentAdapter = {} as SnapshotDocumentAdapter;

/**
 * Sets up the document interface for the background thread.
 * All DOM operations are intercepted to create {@link BackgroundSnapshotInstance}.
 */
function setupBackgroundDocument(): void {
  document.createElement = function(type: string, slotIndex: number = 0) {
    return new BackgroundSnapshotInstance(type, slotIndex);
  };
  document.createElementNS = function(_ns: string, type: string, _is?: string, slotIndex: number = 0) {
    return new BackgroundSnapshotInstance(type, slotIndex);
  };
  document.createTextNode = function(text: string, slotIndex: number = 0) {
    const i = new BackgroundSnapshotInstance(null as unknown as string, slotIndex);
    i.setAttribute(0, text);
    Object.defineProperty(i, 'data', {
      set(v) {
        i.setAttribute(0, v);
      },
    });
    return i;
  };
}

/**
 * Sets up the document interface for the main thread.
 * All DOM operations are intercepted to create {@link SnapshotInstance}.
 */
function setupDocument(): void {
  document.createElement = function(type: string, slotIndex: number = 0) {
    const si = new SnapshotInstance(type);
    si.__slotIndex = slotIndex;
    return si;
  };
  document.createElementNS = function(_ns: string, type: string, _is?: string, slotIndex: number = 0) {
    const si = new SnapshotInstance(type);
    si.__slotIndex = slotIndex;
    return si;
  };
  document.createTextNode = function(text: string, slotIndex: number = 0) {
    const i = new SnapshotInstance(null as unknown as string);
    i.__slotIndex = slotIndex;
    i.setAttribute(0, text);
    Object.defineProperty(i, 'data', {
      set(v) {
        i.setAttribute(0, v);
      },
    });
    return i;
  };
}

// if (__JS__) {
//   setupBackgroundDocument();
// } else if (__LEPUS__) {
//   setupDocument();
// }

export { document, setupBackgroundDocument, setupDocument };
