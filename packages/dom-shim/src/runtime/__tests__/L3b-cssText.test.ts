// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wrapPapi } from '../nodes.ts';
import type { L3bUnsafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  styles: Record<string, unknown>;
  bulk?: Record<string, unknown>;
}

function mk(): MockEl {
  return { tag: 'view', styles: {} };
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__AddInlineStyle'] = (
    n: MockEl,
    k: string | number,
    v: unknown,
  ) => {
    if (typeof k !== 'string') return;
    if (v === undefined) delete n.styles[k];
    else n.styles[k] = v;
  };
  g['__SetInlineStyles'] = (n: MockEl, v: unknown) => {
    n.bulk = v as Record<string, unknown>;
  };
  g['__FlushElementTree'] = () => undefined;
}

describe('US-447 L3b style.cssText setter', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  it('parses simple declarations into the cache', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    e.style.cssText = 'color: red; background: blue';
    expect(e.style.getPropertyValue('color')).toBe('red');
    expect(e.style.getPropertyValue('background')).toBe('blue');
  });

  it('strips /* comments */', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    e.style.cssText = 'color: red; /* this is ignored */ font-size: 12px';
    expect(e.style.getPropertyValue('color')).toBe('red');
    expect(e.style.getPropertyValue('font-size')).toBe('12px');
  });

  it('!important is recorded as priority cache-only (OQ-S.3)', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    e.style.cssText = 'color: red !important; background: blue';
    expect(e.style.getPropertyValue('color')).toBe('red');
    expect(e.style.getPropertyPriority('color')).toBe('important');
    expect(e.style.getPropertyPriority('background')).toBe('');
  });

  it('clears prior styles before applying new ones', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    e.style.setProperty('color', 'red');
    e.style.setProperty('background', 'blue');
    e.style.cssText = 'font-size: 12px';
    expect(e.style.getPropertyValue('color')).toBe('');
    expect(e.style.getPropertyValue('background')).toBe('');
    expect(e.style.getPropertyValue('font-size')).toBe('12px');
  });

  it('empty string clears all styles', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    e.style.setProperty('color', 'red');
    e.style.cssText = '';
    expect(e.style.length).toBe(0);
  });

  it('camelCase keys normalize to kebab-case', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    e.style.cssText = 'backgroundColor: green';
    expect(e.style.getPropertyValue('background-color')).toBe('green');
  });

  it('cssText getter reflects setter values', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    e.style.cssText = 'color: red; background: blue';
    const got = e.style.cssText;
    expect(got).toMatch(/color: red/);
    expect(got).toMatch(/background: blue/);
  });

  it('canonical reorder per shim:L3b/cssText-reorder is allowed', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    e.style.cssText = 'z-index: 1; color: red; padding: 0';
    // Don't assert insertion order; just round-trip preserves all values.
    expect(e.style.getPropertyValue('z-index')).toBe('1');
    expect(e.style.getPropertyValue('color')).toBe('red');
    expect(e.style.getPropertyValue('padding')).toBe('0');
  });
});
