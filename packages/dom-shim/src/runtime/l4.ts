// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getElementCache } from './cache.ts';
import { DOMShimUnsupportedError } from './errors.ts';
import type { ElementRef } from './papi-types.ts';
import { normalizeCSSKey } from './style.ts';

/**
 * L4 unsupported globals. See Shim_Design.md §8.
 *
 * Each global throws `DOMShimUnsupportedError` with the canonical code at
 * access time. The thrown errors are JSON-serializable via toJSON() so the
 * LLM agent loop can detect and repair.
 */

function unsupported(
  code: string,
  surface: string,
  message: string,
  suggestion?: string,
): DOMShimUnsupportedError {
  return new DOMShimUnsupportedError({
    code,
    surface,
    message,
    suggestion,
  });
}

/* ---------- customElements (US-451) ---------- */

interface CustomElementsRegistry {
  define(name: string, ctor: unknown): never;
  whenDefined(name: string): never;
  get(name: string): undefined;
  upgrade(root: unknown): never;
}

export const customElements: CustomElementsRegistry = Object.freeze({
  define(_name: string, _ctor: unknown): never {
    throw unsupported(
      'L4/custom-elements',
      'customElements.define',
      'customElements.define is unsupported.',
      'Compose with ordinary L3 classes using a factory function instead.',
    );
  },
  whenDefined(_name: string): never {
    throw unsupported(
      'L4/custom-elements',
      'customElements.whenDefined',
      'customElements.whenDefined is unsupported.',
    );
  },
  get(_name: string): undefined {
    return undefined;
  },
  upgrade(_root: unknown): never {
    throw unsupported(
      'L4/custom-elements',
      'customElements.upgrade',
      'customElements.upgrade is unsupported.',
    );
  },
});

/* ---------- storage / cookie / location / history (US-452) ---------- */

function throwingProxy(
  code: string,
  surfaceBase: string,
): Record<string, unknown> {
  return new Proxy({}, {
    get(_t, prop): unknown {
      throw unsupported(
        code,
        `${surfaceBase}.${String(prop)}`,
        `${surfaceBase} is unsupported.`,
      );
    },
    set(): boolean {
      throw unsupported(code, surfaceBase, `${surfaceBase} is unsupported.`);
    },
    deleteProperty(): boolean {
      throw unsupported(code, surfaceBase, `${surfaceBase} is unsupported.`);
    },
  });
}

interface CookieStub {
  value: string;
}

export const cookie: CookieStub = {
  get value(): string {
    throw unsupported(
      'L4/cookies',
      'document.cookie',
      'document.cookie is unsupported.',
      'Use Lynx storage API directly.',
    );
  },
  set value(_v: string) {
    throw unsupported(
      'L4/cookies',
      'document.cookie',
      'document.cookie is unsupported.',
    );
  },
};

export const localStorage: Record<string, unknown> = throwingProxy(
  'L4/web-storage',
  'localStorage',
);
export const sessionStorage: Record<string, unknown> = throwingProxy(
  'L4/web-storage',
  'sessionStorage',
);
export const location: Record<string, unknown> = throwingProxy(
  'L4/location-navigation',
  'location',
);
export const history: Record<string, unknown> = throwingProxy(
  'L4/history',
  'history',
);

/* ---------- Observers (US-453) ---------- */

export class MutationObserver {
  constructor(_callback: unknown) {
    throw unsupported(
      'L4/mutation-observer',
      'MutationObserver',
      'MutationObserver is unsupported.',
      'Subscribe via the Shim onMutation event (planned).',
    );
  }
}

export class IntersectionObserver {
  constructor(_callback: unknown, _options?: unknown) {
    throw unsupported(
      'L4/intersection-observer',
      'IntersectionObserver',
      'IntersectionObserver is unsupported.',
      'Use Lynx intersection PAPI via __InvokeUIMethod.',
    );
  }
}

export class ResizeObserver {
  constructor(_callback: unknown) {
    throw unsupported(
      'L4/resize-observer',
      'ResizeObserver',
      'ResizeObserver is unsupported.',
      'Use Lynx layout observer or poll via getBoundingClientRect.',
    );
  }
}

/* ---------- getComputedStyle / CSSOM (US-454) ---------- */

/**
 * Spec getComputedStyle stub. Returns an object whose getPropertyValue
 * works for inline-style properties only (via the Shim cache); any other
 * property throws L4. See Shim_Design.md §8.2 `L4/computed-style-non-inline`.
 */
export function getComputedStyle(el: { papi: ElementRef }): {
  getPropertyValue(name: string): string;
} {
  return {
    getPropertyValue(name: string): string {
      const cache = getElementCache(el.papi);
      const k = normalizeCSSKey(name);
      if (cache.styles.has(k)) return cache.styles.get(k) ?? '';
      throw unsupported(
        'L4/computed-style-non-inline',
        'getComputedStyle.getPropertyValue',
        `getComputedStyle is supported for inline-style properties only; "${name}" is not inline-set.`,
        'Inline-set styles work; resolved/computed styles require engine support.',
      );
    },
  };
}

export class CSSStyleSheet {
  constructor(_options?: unknown) {
    throw unsupported(
      'L4/cssom-construct',
      'CSSStyleSheet',
      'CSSStyleSheet construction is unsupported.',
    );
  }
}

/* ---------- Range / Selection (US-455) ---------- */

export class Range {
  constructor() {
    throw unsupported(
      'L4/range-selection',
      'Range',
      'Range API is unsupported.',
    );
  }
}

export function getSelection(): never {
  throw unsupported(
    'L4/range-selection',
    'window.getSelection',
    'Selection API is unsupported.',
  );
}

/* ---------- Misc (US-455) ---------- */

export class XMLHttpRequest {
  constructor() {
    throw unsupported(
      'L4/xhr',
      'XMLHttpRequest',
      'XMLHttpRequest is unsupported.',
      'Use fetch() or Lynx network PAPI.',
    );
  }
}

export function open(_url?: string, _target?: string): never {
  throw unsupported(
    'L4/blocking-ui',
    'window.open',
    'window.open is unsupported.',
  );
}

export function alert(_msg?: string): never {
  throw unsupported(
    'L4/blocking-ui',
    'alert',
    'alert() is unsupported.',
  );
}

export function confirm(_msg?: string): never {
  throw unsupported(
    'L4/blocking-ui',
    'confirm',
    'confirm() is unsupported.',
  );
}

export function prompt(_msg?: string, _default?: string): never {
  throw unsupported(
    'L4/blocking-ui',
    'prompt',
    'prompt() is unsupported.',
  );
}

/* ---------- Element-level (called from L3b methods) ---------- */

export function throwUnsupportedFor(code: string, surface: string): never {
  throw unsupported(code, surface, `${surface} is unsupported.`);
}
