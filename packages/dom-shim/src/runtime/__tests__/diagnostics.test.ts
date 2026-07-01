// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _resetDiagnosticsForTesting, warnOnce } from '../diagnostics.ts';
import type { ElementRef } from '../papi-types.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
}

function mk(uid: number): MockEl {
  return { tag: 'view', uid };
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetElementUniqueID'] = (n: MockEl) => n.uid;
}

describe('US-449 warnOnce dedupe', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetDiagnosticsForTesting();
    installPapi();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('global dedupe: same code only warned once across calls', () => {
    warnOnce({ code: 'shim:test/x', surface: 'TestSurface' });
    warnOnce({ code: 'shim:test/x', surface: 'TestSurface' });
    warnOnce({ code: 'shim:test/x', surface: 'TestSurface' });
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('different codes are not deduped against each other', () => {
    warnOnce({ code: 'shim:test/x', surface: 'TestSurface' });
    warnOnce({ code: 'shim:test/y', surface: 'TestSurface' });
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('per-element dedupe: same code on different elements both warn', () => {
    const a = mk(1) as ElementRef;
    const b = mk(2) as ElementRef;
    warnOnce({ code: 'shim:L3b/test', surface: 'x' }, a);
    warnOnce({ code: 'shim:L3b/test', surface: 'x' }, a);
    warnOnce({ code: 'shim:L3b/test', surface: 'x' }, b);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('per-element dedupe: same code, same element only warns once', () => {
    const a = mk(1) as ElementRef;
    warnOnce({ code: 'shim:L3b/dup', surface: 'x' }, a);
    warnOnce({ code: 'shim:L3b/dup', surface: 'x' }, a);
    warnOnce({ code: 'shim:L3b/dup', surface: 'x' }, a);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('emits JSON shape with code, tier, surface, message', () => {
    warnOnce({
      code: 'shim:L3b/script-skipped',
      tier: 3,
      subTier: 'b',
      surface: 'Element.innerHTML',
      message: 'script skipped',
      suggestion: 'use module loader',
    });
    const arg = warnSpy.mock.calls[0]?.[0];
    expect(typeof arg).toBe('string');
    const parsed = JSON.parse(arg as string) as Record<string, unknown>;
    expect(parsed['code']).toBe('shim:L3b/script-skipped');
    expect(parsed['tier']).toBe(3);
    expect(parsed['subTier']).toBe('b');
    expect(parsed['surface']).toBe('Element.innerHTML');
    expect(parsed['suggestion']).toBe('use module loader');
  });

  it('includes elementUid + elementTag when an element is provided', () => {
    const a = mk(42) as ElementRef;
    warnOnce({ code: 'shim:L3b/el', surface: 'x' }, a);
    const parsed = JSON.parse(
      warnSpy.mock.calls[0]?.[0] as string,
    ) as Record<string, unknown>;
    expect(parsed['elementUid']).toBe(42);
    expect(parsed['elementTag']).toBe('view');
  });

  it('tier defaults to 3 when omitted', () => {
    warnOnce({ code: 'shim:default-tier', surface: 'x' });
    const parsed = JSON.parse(
      warnSpy.mock.calls[0]?.[0] as string,
    ) as Record<string, unknown>;
    expect(parsed['tier']).toBe(3);
  });
});
