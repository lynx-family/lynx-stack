// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wrapPapi } from '../nodes.ts';
import type { L2SafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  styles: Record<string, unknown>;
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__AddInlineStyle'] = (
    n: MockEl,
    key: string | number,
    value: unknown,
  ) => {
    if (typeof key !== 'string') return;
    if (value === undefined) delete n.styles[key];
    else n.styles[key] = value;
  };
  g['__FlushElementTree'] = () => undefined;
}

function el(): MockEl {
  return { tag: 'view', styles: {} };
}

describe('US-418 camelCase style property accessors', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  it('el.style.color = X writes through to PAPI as kebab', () => {
    const ref = el();
    const e = wrapPapi(ref) as L2SafeWritableElement;
    e.style['color'] = 'red';
    expect(ref.styles['color']).toBe('red');
    expect(e.style['color']).toBe('red');
  });

  it('camelCase backgroundColor → background-color', () => {
    const ref = el();
    const e = wrapPapi(ref) as L2SafeWritableElement;
    e.style['backgroundColor'] = 'blue';
    expect(ref.styles['background-color']).toBe('blue');
    expect(e.style['backgroundColor']).toBe('blue');
  });

  it('borderTopLeftRadius round-trips kebab-form too', () => {
    const e = wrapPapi(el()) as L2SafeWritableElement;
    e.style['borderTopLeftRadius'] = '4px';
    expect(e.style['border-top-left-radius']).toBe('4px');
  });

  it('CSS custom property names pass through unchanged', () => {
    const ref = el();
    const e = wrapPapi(ref) as L2SafeWritableElement;
    e.style['--accent'] = '#f00';
    expect(ref.styles['--accent']).toBe('#f00');
    expect(e.style['--accent']).toBe('#f00');
  });

  it('class methods still work alongside proxy access', () => {
    const e = wrapPapi(el()) as L2SafeWritableElement;
    e.style.setProperty('color', 'red');
    expect(e.style.getPropertyValue('color')).toBe('red');
    expect(e.style['color']).toBe('red');
    expect(e.style.removeProperty('color')).toBe('red');
    expect(e.style['color']).toBe('');
  });

  it('cssText getter still works through proxy', () => {
    const e = wrapPapi(el()) as L2SafeWritableElement;
    e.style['color'] = 'red';
    e.style['fontSize'] = '12px';
    expect(e.style.cssText).toBe('color: red; font-size: 12px');
  });

  it('length / item accessors preserved', () => {
    const e = wrapPapi(el()) as L2SafeWritableElement;
    e.style['color'] = 'red';
    e.style['fontSize'] = '12px';
    expect(e.style.length).toBe(2);
    expect(e.style.item(0)).toBe('color');
  });

  it('Reading an unset camelCase property returns empty string', () => {
    const e = wrapPapi(el()) as L2SafeWritableElement;
    expect(e.style['marginTop']).toBe('');
  });
});
