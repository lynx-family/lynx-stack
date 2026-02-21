// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import type { VNode } from 'preact';

import { DIFFED, DOM } from '../renderToOpcodes/constants.js';

interface SourceInfo {
  fileName?: string;
  lineNumber?: number;
  columnNumber?: number;
}

interface PatchedVNode extends VNode {
  __source?: SourceInfo;
  [DOM]?: { __id?: number } | null;
}

const snapshotVNodeSourceMap: Map<number, string> = new Map();

let hookInstalled = false;

function formatSource(source: SourceInfo): string | undefined {
  if (!source.fileName) {
    return undefined;
  }
  if (typeof source.lineNumber === 'number' && typeof source.columnNumber === 'number') {
    return `${source.fileName}:${source.lineNumber}:${source.columnNumber}`;
  }
  if (typeof source.lineNumber === 'number') {
    return `${source.fileName}:${source.lineNumber}`;
  }
  return source.fileName;
}

function captureVNodeSource(vnode: PatchedVNode): void {
  if (typeof vnode.type !== 'string') {
    return;
  }
  const source = vnode.__source;
  const id = vnode[DOM]?.__id;
  if (!source || typeof id !== 'number') {
    return;
  }
  const formattedSource = formatSource(source);
  if (formattedSource) {
    snapshotVNodeSourceMap.set(id, formattedSource);
  }
}

export function setupVNodeSourceHook(): void {
  if (hookInstalled) {
    return;
  }
  hookInstalled = true;
  const oldDiffed = options[DIFFED];
  options[DIFFED] = (vnode) => {
    captureVNodeSource(vnode as PatchedVNode);
    oldDiffed?.(vnode);
  };
}

export function moveSnapshotVNodeSource(oldId: number, newId: number): void {
  if (oldId === newId) {
    return;
  }
  const source = snapshotVNodeSourceMap.get(oldId);
  if (source) {
    snapshotVNodeSourceMap.set(newId, source);
    snapshotVNodeSourceMap.delete(oldId);
  }
}

export function getSnapshotVNodeSource(id: number): string | undefined {
  return snapshotVNodeSourceMap.get(id);
}

export function clearSnapshotVNodeSource(): void {
  snapshotVNodeSourceMap.clear();
}
