// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it } from 'vitest';

import { DOMShimUnsupportedError } from '../errors.ts';
import { wrapPapi } from '../nodes.ts';
import * as tiersStrict from '../tiers-strict.ts';
import * as tiers from '../tiers.ts';

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
  g['__GetAttributes'] = (n: MockEl) => n.attrs;
  g['__GetAttributeByName'] = (n: MockEl, name: string) => n.attrs[name];
  g['__SetAttribute'] = (n: MockEl, name: string, value: unknown) => {
    if (value === undefined) delete n.attrs[name];
    else n.attrs[name] = value;
  };
  g['__GetID'] = () => '';
  g['__GetClasses'] = () => [];
  g['__FlushElementTree'] = () => undefined;
}

describe('US-448 tier-narrowing helpers', () => {
  beforeEach(() => {
    installPapi();
  });

  describe('non-strict (type-level cast only)', () => {
    it('ReadOnly(el) returns the same underlying ref', () => {
      const e = wrapPapi(mk());
      const narrowed = tiers.ReadOnly(e);
      // Same papi (no Proxy wrapping).
      expect(narrowed.papi).toBe(e.papi);
    });

    it('SafeWrite(el) returns the same underlying ref', () => {
      const e = wrapPapi(mk());
      const narrowed = tiers.SafeWrite(e);
      expect(narrowed.papi).toBe(e.papi);
    });

    it('non-strict ReadOnly does NOT throw on L2 method call at runtime', () => {
      // The whole point of the non-strict variant is that callers can use
      // it as a TypeScript-only narrowing without runtime overhead. So
      // L2+ methods, while a compile error, will succeed at runtime.
      const e = wrapPapi(mk());
      const narrowed = tiers.ReadOnly(e);
      expect(() => {
        (narrowed as { setAttribute?: (n: string, v: string) => void })
          .setAttribute?.('x', '1');
      }).not.toThrow();
    });
  });

  describe('strict (runtime Proxy guard)', () => {
    it('ReadOnly allows L1 getter access', () => {
      const e = wrapPapi(mk());
      const narrowed = tiersStrict.ReadOnly(e);
      expect(() => narrowed.tagName).not.toThrow();
    });

    it('ReadOnly throws DOMShimUnsupportedError on L2 setAttribute', () => {
      const e = wrapPapi(mk());
      const narrowed = tiersStrict.ReadOnly(e) as unknown as {
        setAttribute: (n: string, v: string) => void;
      };
      try {
        narrowed.setAttribute('x', '1');
        expect.fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(DOMShimUnsupportedError);
        const d = (err as DOMShimUnsupportedError).diagnostic;
        expect(d.code).toBe('L4/tier-violation');
      }
    });

    it('SafeWrite allows setAttribute but throws on addEventListener', () => {
      const e = wrapPapi(mk());
      const narrowed = tiersStrict.SafeWrite(e);
      expect(() => narrowed.setAttribute('x', '1')).not.toThrow();
      const narrowedAny = narrowed as unknown as {
        addEventListener: (t: string, fn: () => void) => void;
      };
      try {
        narrowedAny.addEventListener('click', () => undefined);
        expect.fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(DOMShimUnsupportedError);
        expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
          'L4/tier-violation',
        );
      }
    });

    it('Events allows addEventListener but throws on innerHTML', () => {
      const e = wrapPapi(mk());
      const narrowed = tiersStrict.Events(e);
      expect(() => narrowed.addEventListener('click', () => undefined)).not
        .toThrow();
      const narrowedAny = narrowed as unknown as { innerHTML: string };
      try {
        narrowedAny.innerHTML = '<x/>';
        expect.fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(DOMShimUnsupportedError);
        expect((err as DOMShimUnsupportedError).diagnostic.code).toBe(
          'L4/tier-violation',
        );
      }
    });

    it('Unsafe allows everything including innerHTML', () => {
      const e = wrapPapi(mk());
      const narrowed = tiersStrict.Unsafe(e);
      expect(() => narrowed.setAttribute('x', '1')).not.toThrow();
      expect(() => narrowed.addEventListener('click', () => undefined)).not
        .toThrow();
    });

    it('Symbol-keyed properties pass through (iterators, instanceof)', () => {
      const e = wrapPapi(mk());
      const narrowed = tiersStrict.ReadOnly(e);
      // Symbol access should NOT throw.
      expect(() => narrowed[Symbol.iterator as unknown as 'tagName']).not
        .toThrow();
    });
  });
});
