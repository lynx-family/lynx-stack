// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { BackgroundSnapshotInstance } from './snapshot/snapshot/backgroundSnapshot.js';
import { SnapshotInstance } from './snapshot/snapshot/snapshot.js';

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
 * Text node used by Preact's text diffing. The `data` setter lives on the
 * prototype so creating a text node does not pay for a per-instance
 * `Object.defineProperty`. Like the previous per-instance definition, there
 * is deliberately no getter — Preact reads `dom.data` before writing, and
 * `undefined` makes it always write.
 */
class BackgroundTextSnapshotInstance extends BackgroundSnapshotInstance {
  constructor(text: string) {
    super(null as unknown as string);
    this.setAttribute(0, text);
  }

  set data(v: string) {
    this.setAttribute(0, v);
  }
}

class TextSnapshotInstance extends SnapshotInstance {
  constructor(text: string) {
    super(null as unknown as string);
    this.setAttribute(0, text);
  }

  set data(v: string) {
    this.setAttribute(0, v);
  }
}

/**
 * Sets up the document interface for the background thread.
 * All DOM operations are intercepted to create {@link BackgroundSnapshotInstance}.
 */
function setupBackgroundDocument(_document: SnapshotDocumentAdapter = document): void {
  _document.createElement = function(type: string) {
    return new BackgroundSnapshotInstance(type);
  };
  _document.createElementNS = function(_ns: string, type: string, _is?: string) {
    return new BackgroundSnapshotInstance(type);
  };
  _document.createTextNode = function(text: string) {
    return new BackgroundTextSnapshotInstance(text);
  };
}

/**
 * Sets up the document interface for the main thread.
 * All DOM operations are intercepted to create {@link SnapshotInstance}.
 */
function setupDocument(_document: SnapshotDocumentAdapter = document): void {
  _document.createElement = function(type: string) {
    const si = new SnapshotInstance(type);
    return si;
  };
  _document.createElementNS = function(_ns: string, type: string, _is?: string) {
    const si = new SnapshotInstance(type);
    return si;
  };
  _document.createTextNode = function(text: string) {
    return new TextSnapshotInstance(text);
  };
}

// if (__JS__) {
//   setupBackgroundDocument();
// } else if (__LEPUS__) {
//   setupDocument();
// }

export { document, setupBackgroundDocument, setupDocument };
