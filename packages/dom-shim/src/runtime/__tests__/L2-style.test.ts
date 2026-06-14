// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wrapPapi } from '../nodes.ts';
import type { L2SafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';
import { L2CSSStyleDeclaration, camelToKebab } from '../style.ts';

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

describe('US-417 L2CSSStyleDeclaration', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  describe('camelToKebab', () => {
    it('converts camelCase', () => {
      expect(camelToKebab('backgroundColor')).toBe('background-color');
      expect(camelToKebab('borderTopLeftRadius')).toBe(
        'border-top-left-radius',
      );
    });

    it('passes through already-kebab', () => {
      expect(camelToKebab('color')).toBe('color');
      expect(camelToKebab('background-color')).toBe('background-color');
    });

    it('preserves CSS custom properties', () => {
      expect(camelToKebab('--my-var')).toBe('--my-var');
      expect(camelToKebab('--bg')).toBe('--bg');
    });
  });

  it('style is an L2CSSStyleDeclaration', () => {
    const e = wrapPapi(el()) as L2SafeWritableElement;
    expect(e.style).toBeInstanceOf(L2CSSStyleDeclaration);
  });

  describe('setProperty / getPropertyValue', () => {
    it('round-trips with kebab-case key', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      e.style.setProperty('color', 'red');
      expect(e.style.getPropertyValue('color')).toBe('red');
    });

    it('camelCase key is normalized to kebab', () => {
      const ref = el();
      const e = wrapPapi(ref) as L2SafeWritableElement;
      e.style.setProperty('backgroundColor', 'blue');
      expect(e.style.getPropertyValue('backgroundColor')).toBe('blue');
      expect(e.style.getPropertyValue('background-color')).toBe('blue');
      expect(ref.styles['background-color']).toBe('blue');
    });

    it('returns empty string for unset property', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      expect(e.style.getPropertyValue('color')).toBe('');
    });

    it('preserves CSS custom property names', () => {
      const ref = el();
      const e = wrapPapi(ref) as L2SafeWritableElement;
      e.style.setProperty('--accent', '#f00');
      expect(e.style.getPropertyValue('--accent')).toBe('#f00');
      expect(ref.styles['--accent']).toBe('#f00');
    });
  });

  describe('removeProperty', () => {
    it('returns previous value and clears', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      e.style.setProperty('color', 'red');
      expect(e.style.removeProperty('color')).toBe('red');
      expect(e.style.getPropertyValue('color')).toBe('');
    });

    it('returns empty string when unset', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      expect(e.style.removeProperty('color')).toBe('');
    });
  });

  describe('priority (OQ-S.3: cache-only)', () => {
    it('records priority in cache via getPropertyPriority', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      e.style.setProperty('color', 'red', 'important');
      expect(e.style.getPropertyPriority('color')).toBe('important');
    });

    it('clears priority when setProperty without priority', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      e.style.setProperty('color', 'red', 'important');
      e.style.setProperty('color', 'blue');
      expect(e.style.getPropertyPriority('color')).toBe('');
    });
  });

  describe('length / item / iterator', () => {
    it('length reflects set property count', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      expect(e.style.length).toBe(0);
      e.style.setProperty('color', 'red');
      e.style.setProperty('background', 'blue');
      expect(e.style.length).toBe(2);
    });

    it('item returns property name at index', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      e.style.setProperty('color', 'red');
      e.style.setProperty('background', 'blue');
      expect(e.style.item(0)).toBe('color');
      expect(e.style.item(1)).toBe('background');
      expect(e.style.item(2)).toBe('');
    });

    it('iterable yields property names', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      e.style.setProperty('color', 'red');
      e.style.setProperty('background', 'blue');
      expect([...e.style]).toEqual(['color', 'background']);
    });
  });

  describe('cssText getter (setter is L3b/US-447)', () => {
    it('joins entries with semicolons', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      e.style.setProperty('color', 'red');
      e.style.setProperty('background', 'blue');
      expect(e.style.cssText).toBe('color: red; background: blue');
    });

    it('empty when no styles set', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      expect(e.style.cssText).toBe('');
    });
  });

  it('mutations schedule auto-flush', async () => {
    let flushed = 0;
    (globalThis as Record<string, unknown>)['__FlushElementTree'] = () => {
      flushed++;
    };
    const e = wrapPapi(el()) as L2SafeWritableElement;
    e.style.setProperty('color', 'red');
    e.style.setProperty('background', 'blue');
    e.style.removeProperty('color');
    expect(flushed).toBe(0);
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(flushed).toBe(1);
  });
});
