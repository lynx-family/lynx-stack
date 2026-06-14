// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeAll, describe, expect, it } from 'vitest';

import {
  L1ReadOnlyElement,
  L1ReadOnlyNode,
  L1ReadOnlyText,
  document,
  wrapPapi,
} from '../index.ts';
import type { ElementRef } from '../index.ts';

/**
 * US-401 — bootstrap: classes can be instantiated, wrapPapi dispatches by tag.
 */
describe('US-401 bootstrap', () => {
  beforeAll(() => {
    // Stub the minimum PAPI global needed for wrapPapi.
    (globalThis as Record<string, unknown>)['__GetTag'] = (
      ref: ElementRef,
    ) => ((ref as { tag?: string }).tag ?? 'view');
  });

  it('L1ReadOnlyNode is abstract — cannot instantiate directly', () => {
    // Direct construction is a compile error; the abstract guard relies on
    // TypeScript. At runtime, ES class semantics still allow `new`, so we
    // assert the subclass relationship instead.
    const ref: ElementRef = {};
    const text = new L1ReadOnlyText(ref);
    expect(text).toBeInstanceOf(L1ReadOnlyNode);
  });

  it('L1ReadOnlyElement instantiates with an ElementRef', () => {
    const ref: ElementRef = { tag: 'view' };
    const el = new L1ReadOnlyElement(ref);
    expect(el).toBeInstanceOf(L1ReadOnlyElement);
    expect(el).toBeInstanceOf(L1ReadOnlyNode);
  });

  it('L1ReadOnlyText instantiates with an ElementRef', () => {
    const ref: ElementRef = { tag: 'raw-text' };
    const text = new L1ReadOnlyText(ref);
    expect(text).toBeInstanceOf(L1ReadOnlyText);
    expect(text).toBeInstanceOf(L1ReadOnlyNode);
    // Spec divergence: L1ReadOnlyText is NOT an Element. See Shim_Design.md
    // §4.2.2.
    expect(text).not.toBeInstanceOf(L1ReadOnlyElement);
  });

  it('wrapPapi returns L1ReadOnlyText for raw-text tag', () => {
    const ref: ElementRef = { tag: 'raw-text' };
    const wrapped = wrapPapi(ref);
    expect(wrapped).toBeInstanceOf(L1ReadOnlyText);
  });

  it('wrapPapi returns L1ReadOnlyElement for view tag', () => {
    const ref: ElementRef = { tag: 'view' };
    const wrapped = wrapPapi(ref);
    expect(wrapped).toBeInstanceOf(L1ReadOnlyElement);
  });

  it('wrapPapi falls back to L1ReadOnlyElement for unknown tags', () => {
    // Per Shim_Design.md §7.4 the permissive tag fallback maps unknown HTML
    // tags to view at element-creation time. wrapPapi just sees a Lynx tag
    // here and dispatches anything non-text to L1ReadOnlyElement.
    const ref: ElementRef = { tag: 'some-future-lynx-tag' };
    const wrapped = wrapPapi(ref);
    expect(wrapped).toBeInstanceOf(L1ReadOnlyElement);
  });

  it('document export exists', () => {
    expect(document).toBeDefined();
  });
});
