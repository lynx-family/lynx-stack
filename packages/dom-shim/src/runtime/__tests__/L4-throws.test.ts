// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DOMShimUnsupportedError } from '../errors.ts';
import { ShimEvent } from '../events.ts';
import * as l4 from '../l4.ts';
import { wrapPapi } from '../nodes.ts';
import type { L3aEventfulElement, L3bUnsafeWritableElement } from '../nodes.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  attrs: Record<string, unknown>;
}

function mk(): MockEl {
  return { tag: 'view', attrs: {} };
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetElementUniqueID'] = () => 1;
  g['__GetAttributes'] = (n: MockEl) => n.attrs;
  g['__GetAttributeByName'] = (n: MockEl, name: string) => n.attrs[name];
  g['__GetID'] = () => '';
  g['__GetClasses'] = () => [];
  g['__SetAttribute'] = (n: MockEl, name: string, value: unknown) => {
    if (value === undefined) delete n.attrs[name];
    else n.attrs[name] = value;
  };
  g['__AddInlineStyle'] = () => undefined;
  g['__FlushElementTree'] = () => undefined;
}

function catchErr(fn: () => unknown): unknown {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e;
  }
}

describe('US-451 Shadow DOM + customElements', () => {
  beforeEach(() => installPapi());

  it('Element.attachShadow throws L4/shadow-dom', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    const err = catchErr(() => e.attachShadow({ mode: 'open' }));
    expect(err).toBeInstanceOf(DOMShimUnsupportedError);
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/shadow-dom',
    );
  });

  it('Element.shadowRoot returns null and warns once', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() =>
      undefined
    );
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    expect(e.shadowRoot).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(e.shadowRoot).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('customElements.define throws L4/custom-elements', () => {
    const err = catchErr(() => l4.customElements.define('x-el', class {}));
    expect(err).toBeInstanceOf(DOMShimUnsupportedError);
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/custom-elements',
    );
  });

  it('customElements.whenDefined throws', () => {
    const err = catchErr(() => l4.customElements.whenDefined('x'));
    expect(err).toBeInstanceOf(DOMShimUnsupportedError);
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/custom-elements',
    );
  });

  it('customElements.get returns undefined (read-only allowed)', () => {
    expect(l4.customElements.get('anything')).toBeUndefined();
  });
});

describe('US-452 storage / cookie / location / history', () => {
  beforeEach(() => installPapi());

  it('document.cookie getter throws L4/cookies', () => {
    const err = catchErr(() => l4.cookie.value);
    expect(err).toBeInstanceOf(DOMShimUnsupportedError);
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/cookies',
    );
  });

  it('document.cookie setter throws L4/cookies', () => {
    const err = catchErr(() => {
      l4.cookie.value = 'x=1';
    });
    expect(err).toBeInstanceOf(DOMShimUnsupportedError);
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/cookies',
    );
  });

  it('localStorage access throws L4/web-storage', () => {
    const err = catchErr(() => l4.localStorage['key']);
    expect(err).toBeInstanceOf(DOMShimUnsupportedError);
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/web-storage',
    );
  });

  it('sessionStorage access throws L4/web-storage', () => {
    const err = catchErr(() => l4.sessionStorage['key']);
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/web-storage',
    );
  });

  it('location access throws L4/location-navigation', () => {
    const err = catchErr(() => l4.location['href']);
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/location-navigation',
    );
  });

  it('history access throws L4/history', () => {
    const err = catchErr(() => l4.history['pushState']);
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/history',
    );
  });
});

describe('US-453 Observer constructors throw', () => {
  it('MutationObserver throws', () => {
    const err = catchErr(() => new l4.MutationObserver(() => undefined));
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/mutation-observer',
    );
  });

  it('IntersectionObserver throws', () => {
    const err = catchErr(() => new l4.IntersectionObserver(() => undefined));
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/intersection-observer',
    );
  });

  it('ResizeObserver throws', () => {
    const err = catchErr(() => new l4.ResizeObserver(() => undefined));
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/resize-observer',
    );
  });
});

describe('US-454 getComputedStyle + CSSOM', () => {
  beforeEach(() => installPapi());

  it('getComputedStyle returns inline-style values from cache', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    e.style.setProperty('color', 'red');
    const cs = l4.getComputedStyle(e);
    expect(cs.getPropertyValue('color')).toBe('red');
  });

  it('getComputedStyle throws on non-inline property', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    const cs = l4.getComputedStyle(e);
    const err = catchErr(() => cs.getPropertyValue('background'));
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/computed-style-non-inline',
    );
  });

  it('new CSSStyleSheet throws L4/cssom-construct', () => {
    const err = catchErr(() => new l4.CSSStyleSheet());
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/cssom-construct',
    );
  });
});

describe('US-455 Remaining L4 surfaces', () => {
  beforeEach(() => installPapi());

  it.each([
    ['new Range', () => new l4.Range(), 'L4/range-selection'],
    ['getSelection', () => l4.getSelection(), 'L4/range-selection'],
    ['new XMLHttpRequest', () => new l4.XMLHttpRequest(), 'L4/xhr'],
    ['window.open', () => l4.open('https://x'), 'L4/blocking-ui'],
    ['alert', () => l4.alert('hi'), 'L4/blocking-ui'],
    ['confirm', () => l4.confirm('?'), 'L4/blocking-ui'],
    ['prompt', () => l4.prompt('q'), 'L4/blocking-ui'],
  ])('%s throws %s', (_label, fn, code) => {
    const err = catchErr(fn);
    expect(err).toBeInstanceOf(DOMShimUnsupportedError);
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(code);
  });

  it('Element.innerText getter throws L4/innerText-layout', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    const err = catchErr(() => e.innerText);
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/innerText-layout',
    );
  });

  it('Element.requestFullscreen throws L4/fullscreen', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    const err = catchErr(() => e.requestFullscreen());
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/fullscreen',
    );
  });

  it('Element.requestPointerLock throws L4/pointer-lock', () => {
    const e = wrapPapi(mk()) as L3bUnsafeWritableElement;
    const err = catchErr(() => e.requestPointerLock());
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/pointer-lock',
    );
  });

  it('Element.dispatchEvent on synthetic Event throws L4/synthetic-dispatch', () => {
    const e = wrapPapi(mk()) as L3aEventfulElement;
    const err = catchErr(() => e.dispatchEvent(new ShimEvent('click')));
    expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
      'L4/synthetic-dispatch',
    );
  });
});
