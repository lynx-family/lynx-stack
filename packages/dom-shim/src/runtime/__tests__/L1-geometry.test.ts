// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GEOMETRY_STALE_CODE, invalidateGeometry } from '../geometry.ts';
import { wrapPapi } from '../nodes.ts';
import type { L1ReadOnlyElement } from '../nodes.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  rect?: { left: number; top: number; width: number; height: number };
}

function makeEl(rect?: MockEl['rect']): MockEl {
  return { tag: 'view', rect };
}

/**
 * Installs PAPI globals that, on `__InvokeUIMethod('boundingClientRect')`,
 * synchronously fire the callback with the el's stashed rect. This is the
 * synchronous-callback path the cache should fill from.
 */
function installPapi(syncCallback = true): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__InvokeUIMethod'] = (
    e: MockEl,
    method: string,
    _params: Record<string, unknown>,
    cb: (res: { code: number; data: unknown }) => void,
  ) => {
    if (method !== 'boundingClientRect') return [];
    if (!syncCallback) return [];
    if (e.rect) cb({ code: 0, data: e.rect });
    else cb({ code: 1, data: null });
    return [];
  };
}

describe('US-409 L1 getBoundingClientRect (async-cached)', () => {
  beforeEach(() => {
    installPapi();
    vi.restoreAllMocks();
  });

  it('returns zero rect on first call when no measurement is available', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() =>
      undefined
    );
    installPapi(false); // PAPI present but never fires the callback.
    const el = wrapPapi(makeEl()) as L1ReadOnlyElement;
    const rect = el.getBoundingClientRect();
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(GEOMETRY_STALE_CODE);
  });

  it('returns the measured rect when the callback fires synchronously', () => {
    const el = wrapPapi(
      makeEl({ left: 10, top: 20, width: 100, height: 50 }),
    ) as L1ReadOnlyElement;
    const rect = el.getBoundingClientRect();
    expect(rect.x).toBe(10);
    expect(rect.y).toBe(20);
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(50);
    expect(rect.right).toBe(110);
    expect(rect.bottom).toBe(70);
  });

  it('warns only once per element across repeated calls', () => {
    installPapi(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() =>
      undefined
    );
    const el = wrapPapi(makeEl()) as L1ReadOnlyElement;
    el.getBoundingClientRect();
    el.getBoundingClientRect();
    el.getBoundingClientRect();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('returns the cached rect on subsequent calls', () => {
    const ref = makeEl({ left: 1, top: 2, width: 3, height: 4 });
    const el = wrapPapi(ref) as L1ReadOnlyElement;
    const first = el.getBoundingClientRect();
    expect(first.x).toBe(1);
    // Mutate the underlying ref's rect — should not be observed because cache hit.
    ref.rect = { left: 999, top: 999, width: 999, height: 999 };
    const second = el.getBoundingClientRect();
    expect(second.x).toBe(1);
  });

  it('invalidateGeometry drops the cache, triggering a re-measure', () => {
    const ref = makeEl({ left: 1, top: 2, width: 3, height: 4 });
    const el = wrapPapi(ref) as L1ReadOnlyElement;
    expect(el.getBoundingClientRect().x).toBe(1);
    ref.rect = { left: 100, top: 200, width: 300, height: 400 };
    invalidateGeometry(ref);
    expect(el.getBoundingClientRect().x).toBe(100);
  });

  it('returns frozen DOMRectReadOnly', () => {
    const el = wrapPapi(
      makeEl({ left: 0, top: 0, width: 1, height: 1 }),
    ) as L1ReadOnlyElement;
    const rect = el.getBoundingClientRect();
    expect(Object.isFrozen(rect)).toBe(true);
  });

  it('handles engine error code by returning zero', () => {
    const el = wrapPapi(makeEl()) as L1ReadOnlyElement;
    // PAPI mock fires cb({code:1, data:null}) when no rect is set.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rect = el.getBoundingClientRect();
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);
  });
});
