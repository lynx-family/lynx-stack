/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { options } from 'preact';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  clearSnapshotVNodeSource,
  getSnapshotVNodeSource,
  moveSnapshotVNodeSource,
  setupVNodeSourceHook,
} from '../../src/debug/vnodeSource';
import { DIFFED, DOM } from '../../src/renderToOpcodes/constants';

describe('vnodeSource', () => {
  let originalDiffed: typeof options[typeof DIFFED];
  let oldDiffedHook: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    originalDiffed = options[DIFFED];
    oldDiffedHook = vi.fn();
    options[DIFFED] = oldDiffedHook;
    setupVNodeSourceHook();
  });

  afterEach(() => {
    clearSnapshotVNodeSource();
    oldDiffedHook.mockClear();
  });

  afterAll(() => {
    options[DIFFED] = originalDiffed;
    clearSnapshotVNodeSource();
  });

  it('should install hook once and call previous DIFFED hook', () => {
    const installedHook = options[DIFFED];
    setupVNodeSourceHook();
    expect(options[DIFFED]).toBe(installedHook);

    const vnode = {
      type: 'view',
      __source: {
        fileName: 'component.tsx',
        lineNumber: 10,
        columnNumber: 20,
      },
      [DOM]: { __id: 101 },
    };

    options[DIFFED]?.(vnode as never);

    expect(oldDiffedHook).toBeCalledWith(vnode);
    expect(getSnapshotVNodeSource(101)).toBe('component.tsx:10:20');
  });

  it('should format source with file:line and file only', () => {
    options[DIFFED]?.({
      type: 'view',
      __source: { fileName: 'line-only.tsx', lineNumber: 7 },
      [DOM]: { __id: 201 },
    } as never);
    options[DIFFED]?.({
      type: 'view',
      __source: { fileName: 'file-only.tsx' },
      [DOM]: { __id: 202 },
    } as never);

    expect(getSnapshotVNodeSource(201)).toBe('line-only.tsx:7');
    expect(getSnapshotVNodeSource(202)).toBe('file-only.tsx');
  });

  it('should ignore vnode without valid type/source/id', () => {
    options[DIFFED]?.({
      type: () => null,
      __source: { fileName: 'ignored.tsx', lineNumber: 1, columnNumber: 1 },
      [DOM]: { __id: 301 },
    } as never);
    options[DIFFED]?.({
      type: 'view',
      [DOM]: { __id: 302 },
    } as never);
    options[DIFFED]?.({
      type: 'view',
      __source: { lineNumber: 1, columnNumber: 1 },
      [DOM]: { __id: 303 },
    } as never);
    options[DIFFED]?.({
      type: 'view',
      __source: { fileName: 'no-id.tsx', lineNumber: 1, columnNumber: 1 },
      [DOM]: {},
    } as never);

    expect(getSnapshotVNodeSource(301)).toBeUndefined();
    expect(getSnapshotVNodeSource(302)).toBeUndefined();
    expect(getSnapshotVNodeSource(303)).toBeUndefined();
  });

  it('should move and clear source entries', () => {
    options[DIFFED]?.({
      type: 'view',
      __source: { fileName: 'move.tsx', lineNumber: 9, columnNumber: 8 },
      [DOM]: { __id: 401 },
    } as never);

    expect(getSnapshotVNodeSource(401)).toBe('move.tsx:9:8');

    moveSnapshotVNodeSource(401, 402);
    expect(getSnapshotVNodeSource(401)).toBeUndefined();
    expect(getSnapshotVNodeSource(402)).toBe('move.tsx:9:8');

    moveSnapshotVNodeSource(402, 402);
    expect(getSnapshotVNodeSource(402)).toBe('move.tsx:9:8');

    clearSnapshotVNodeSource();
    expect(getSnapshotVNodeSource(402)).toBeUndefined();
  });
});
