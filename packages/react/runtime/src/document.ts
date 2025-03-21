// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { BackgroundSnapshotInstance } from './backgroundSnapshot.js';
import { SnapshotInstance } from './snapshot.js';

const document: any = {};

function setupBackgroundDocument(): void {
  document.createElement = function(type: string) {
    return new BackgroundSnapshotInstance(type);
  };
  document.createElementNS = function(_ns: string, type: string) {
    return new BackgroundSnapshotInstance(type);
  };
  document.createTextNode = function(text: string) {
    const i = new BackgroundSnapshotInstance(null as unknown as string);
    i.setAttribute(0, text);
    Object.defineProperty(i, 'data', {
      set(v) {
        i.setAttribute(0, v);
      },
    });
    return i;
  };
}

function setupDocument(): void {
  document.createElement = function(type: string) {
    return new SnapshotInstance(type);
  };
  document.createElementNS = function(_ns: string, type: string) {
    return new SnapshotInstance(type);
  };
  document.createTextNode = function(text: string) {
    const i = new SnapshotInstance(null as unknown as string);
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

export { setupBackgroundDocument, setupDocument, document };
