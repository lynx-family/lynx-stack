// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DOMShimDivergenceWarning,
  DOMShimInvariantError,
  DOMShimUnsupportedError,
  elementDiagnosticContext,
} from '../errors.ts';

describe('US-442 DOMShim error hierarchy', () => {
  describe('DOMShimUnsupportedError', () => {
    it('extends Error and carries diagnostic', () => {
      const e = new DOMShimUnsupportedError({
        code: 'L4/shadow-dom',
        surface: 'Element.attachShadow',
        message: 'Shadow DOM is unsupported.',
        suggestion: 'Use class-scoped CSS instead.',
      });
      expect(e).toBeInstanceOf(Error);
      expect(e.name).toBe('DOMShimUnsupportedError');
      expect(e.message).toBe('Shadow DOM is unsupported.');
      expect(e.diagnostic.tier).toBe(4);
      expect(e.diagnostic.code).toBe('L4/shadow-dom');
      expect(e.diagnostic.suggestion).toBe('Use class-scoped CSS instead.');
    });

    it('toJSON returns structured payload', () => {
      const e = new DOMShimUnsupportedError({
        code: 'L4/mutation-observer',
        surface: 'MutationObserver',
        message: 'No mutation observer.',
      });
      const json = e.toJSON();
      expect(json.code).toBe('L4/mutation-observer');
      expect(json.tier).toBe(4);
      expect(json.surface).toBe('MutationObserver');
      expect(json.message).toBe('No mutation observer.');
    });

    it('throws and can be caught with instanceof', () => {
      try {
        throw new DOMShimUnsupportedError({
          code: 'L4/range',
          surface: 'Range',
          message: 'no',
        });
      } catch (e) {
        expect(e).toBeInstanceOf(DOMShimUnsupportedError);
        expect((e as DOMShimUnsupportedError).diagnostic.code).toBe(
          'L4/range',
        );
      }
    });
  });

  describe('DOMShimInvariantError', () => {
    it('defaults to tier 2', () => {
      const e = new DOMShimInvariantError({
        code: 'NotFoundError',
        surface: 'Element.removeChild',
        message: 'target is not a child',
      });
      expect(e.diagnostic.tier).toBe(2);
    });

    it('accepts a custom tier', () => {
      const e = new DOMShimInvariantError({
        code: 'L1/dataset-readonly',
        surface: 'Element.dataset',
        message: 'readonly',
        tier: 1,
      });
      expect(e.diagnostic.tier).toBe(1);
    });

    it('toJSON returns spec shape', () => {
      const e = new DOMShimInvariantError({
        code: 'NotFoundError',
        surface: 'Element.removeChild',
        message: 'no',
      });
      const json = e.toJSON();
      expect(json.tier).toBe(2);
      expect(json.code).toBe('NotFoundError');
    });
  });

  describe('DOMShimDivergenceWarning', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('does not throw — exposes emit() for console.warn', () => {
      const w = new DOMShimDivergenceWarning({
        code: 'shim:L3b/script-skipped',
        surface: 'Element.innerHTML',
        message: '<script> skipped',
      });
      expect(warnSpy).not.toHaveBeenCalled();
      w.emit();
      expect(warnSpy).toHaveBeenCalledOnce();
      const arg = warnSpy.mock.calls[0]?.[0];
      expect(typeof arg).toBe('string');
      const parsed = JSON.parse(arg as string) as { code: string };
      expect(parsed.code).toBe('shim:L3b/script-skipped');
    });

    it('defaults to tier 3', () => {
      const w = new DOMShimDivergenceWarning({
        code: 'shim:L3b/test',
        surface: 'x',
        message: 'm',
      });
      expect(w.diagnostic.tier).toBe(3);
    });
  });

  describe('position capture', () => {
    it('fills position with file/line/column when stack is available', () => {
      const e = new DOMShimUnsupportedError({
        code: 'L4/test',
        surface: 'x',
        message: 'm',
      });
      // We can't assert exact line/column but presence and shape is checkable.
      if (e.diagnostic.position) {
        expect(typeof e.diagnostic.position.file).toBe('string');
        expect(typeof e.diagnostic.position.line).toBe('number');
        expect(typeof e.diagnostic.position.column).toBe('number');
      }
    });
  });

  describe('elementDiagnosticContext', () => {
    it('extracts uid and tag from a PAPI ref', () => {
      (globalThis as Record<string, unknown>)['__GetElementUniqueID'] = () =>
        42;
      (globalThis as Record<string, unknown>)['__GetTag'] = () => 'view';
      const ctx = elementDiagnosticContext({});
      expect(ctx.elementUid).toBe(42);
      expect(ctx.elementTag).toBe('view');
    });
  });
});
