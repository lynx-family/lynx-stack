// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { L2SafeWritableElement, wrapPapi } from '../nodes.ts';
import type { ElementRef } from '../papi-types.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  attrs: Record<string, unknown>;
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetAttributeByName'] = (n: MockEl, name: string) => n.attrs[name];
  g['__GetAttributeNames'] = (n: MockEl) => Object.keys(n.attrs);
  g['__GetAttributes'] = (n: MockEl) => n.attrs;
  g['__SetAttribute'] = (n: MockEl, name: string, value: unknown) => {
    if (value === undefined) {
      delete n.attrs[name];
    } else {
      n.attrs[name] = value;
    }
  };
  g['__FlushElementTree'] = () => undefined;
}

function el(attrs: Record<string, unknown> = {}): MockEl {
  return { tag: 'view', attrs };
}

describe('US-413 L2 setAttribute / removeAttribute / toggleAttribute', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  it('wrapPapi returns L2SafeWritableElement for non-text', () => {
    const e = wrapPapi(el());
    expect(e).toBeInstanceOf(L2SafeWritableElement);
  });

  it('setAttribute round-trips synchronously', () => {
    const ref: ElementRef = el();
    const e = wrapPapi(ref) as L2SafeWritableElement;
    e.setAttribute('id', 'main');
    expect(e.getAttribute('id')).toBe('main');
  });

  it('setAttribute writes to PAPI', () => {
    const ref = el();
    const e = wrapPapi(ref) as L2SafeWritableElement;
    e.setAttribute('data-x', 'value');
    expect(ref.attrs['data-x']).toBe('value');
  });

  it('removeAttribute makes getAttribute return null even when PAPI keeps a slot', () => {
    const ref = el({ x: '1' });
    const e = wrapPapi(ref) as L2SafeWritableElement;
    expect(e.getAttribute('x')).toBe('1');
    e.removeAttribute('x');
    expect(e.getAttribute('x')).toBeNull();
  });

  it('setAttribute after removeAttribute clears the removed-marker', () => {
    const ref = el({ x: '1' });
    const e = wrapPapi(ref) as L2SafeWritableElement;
    e.removeAttribute('x');
    expect(e.getAttribute('x')).toBeNull();
    e.setAttribute('x', '2');
    expect(e.getAttribute('x')).toBe('2');
  });

  it('toggleAttribute without force adds when absent', () => {
    const e = wrapPapi(el()) as L2SafeWritableElement;
    expect(e.toggleAttribute('disabled')).toBe(true);
    expect(e.getAttribute('disabled')).toBe('');
  });

  it('toggleAttribute without force removes when present', () => {
    const e = wrapPapi(el({ disabled: '' })) as L2SafeWritableElement;
    expect(e.toggleAttribute('disabled')).toBe(false);
    expect(e.getAttribute('disabled')).toBeNull();
  });

  it('toggleAttribute force=true is idempotent', () => {
    const e = wrapPapi(el()) as L2SafeWritableElement;
    expect(e.toggleAttribute('flag', true)).toBe(true);
    expect(e.toggleAttribute('flag', true)).toBe(true);
    expect(e.getAttribute('flag')).toBe('');
  });

  it('toggleAttribute force=false is idempotent', () => {
    const e = wrapPapi(el({ x: '1' })) as L2SafeWritableElement;
    expect(e.toggleAttribute('x', false)).toBe(false);
    expect(e.toggleAttribute('x', false)).toBe(false);
    expect(e.getAttribute('x')).toBeNull();
  });

  it('coerces non-string values via coerceAttributeValue', () => {
    const e = wrapPapi(el()) as L2SafeWritableElement;
    e.setAttribute('n', 42 as unknown as string);
    e.setAttribute('b', true as unknown as string);
    expect(e.getAttribute('n')).toBe('42');
    expect(e.getAttribute('b')).toBe('true');
  });

  it('mutations schedule auto-flush', async () => {
    let flushed = 0;
    (globalThis as Record<string, unknown>)['__FlushElementTree'] = () => {
      flushed++;
    };
    const e = wrapPapi(el()) as L2SafeWritableElement;
    e.setAttribute('a', '1');
    e.setAttribute('b', '2');
    e.setAttribute('c', '3');
    expect(flushed).toBe(0);
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(flushed).toBe(1);
  });
});
