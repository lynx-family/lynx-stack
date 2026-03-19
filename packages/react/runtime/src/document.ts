// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options } from 'preact';
import type { ContainerNode, VNode } from 'preact';

import { setupDom } from './backgroundSnapshot.js';
import type { BackgroundDOM } from './backgroundSnapshot.js';
import { setRoot } from './root.js';
import { SnapshotInstance } from './snapshot.js';

type SnapshotDocumentNode = BackgroundDOM | SnapshotInstance;

interface SnapshotDocumentAdapter {
  createElement(type: string): SnapshotDocumentNode;
  createElementNS(ns: string | null, type: string): SnapshotDocumentNode;
  createTextNode(text: string): SnapshotDocumentNode & { data?: string };
}

export const document: SnapshotDocumentAdapter = {} as SnapshotDocumentAdapter;

function setupTextNodeData<T extends { setAttribute(key: string | number, value: unknown): void }>(
  node: T,
  text: string,
): T & { data?: string } {
  node.setAttribute(0, text);
  Object.defineProperty(node, 'data', {
    configurable: true,
    enumerable: false,
    set(value) {
      node.setAttribute(0, value);
    },
  });
  return node as T & { data?: string };
}

export function setupBackgroundDocument(): void {
  document.createElement = (type: string) => setupDom({ type } as BackgroundDOM);
  document.createElementNS = (_ns: string | null, type: string) => setupDom({ type } as BackgroundDOM);
  document.createTextNode = (text: string) =>
    setupTextNodeData(
      setupDom({ type: null as unknown as string } as BackgroundDOM),
      text,
    );

  options.setupDom = setupDom;
  setRoot(setupDom({ type: 'root' } as BackgroundDOM));
  globalThis.document = document as unknown as Document;
}

export function setupDocument(): void {
  document.createElement = (type: string) => new SnapshotInstance(type);
  document.createElementNS = (_ns: string | null, type: string) => new SnapshotInstance(type);
  document.createTextNode = (text: string) =>
    setupTextNodeData(
      new SnapshotInstance(null as unknown as string),
      text,
    );

  options.setupDom = (vnode: VNode) => {
    const snapshotVNode = vnode as VNode & SnapshotInstance & ContainerNode;
    Object.assign(snapshotVNode, new SnapshotInstance(vnode.type as string));
    Object.setPrototypeOf(snapshotVNode, SnapshotInstance.prototype);
    return snapshotVNode;
  };
  setRoot(new SnapshotInstance('root'));
  globalThis.document = document as unknown as Document;
}
