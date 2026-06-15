// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ElementRef } from './papi-types.ts';

/**
 * Divergence diagnostic dedupe. See Shim_Design.md Appendix A.
 *
 * `warnOnce(code, surface, el?)` writes a single `console.warn` per
 * `(code, papi-uid)` pair. The structured JSON shape lines up with the
 * `DOMShimDivergenceWarning.toJSON()` envelope so the LLM agent loop
 * (US-461..US-468) can parse it.
 *
 * Documented codes live in SPEC/DIAGNOSTICS.md; any new code introduced
 * by the runtime should land in that catalog at the same time.
 */

const elementWarnings = new WeakMap<ElementRef, Set<string>>();
const globalWarnings = new Set<string>();

export interface WarnOncePayload {
  code: string;
  surface: string;
  message?: string;
  suggestion?: string;
  tier?: 1 | 2 | 3 | 4;
  subTier?: 'a' | 'b';
}

/**
 * Emit a single `console.warn` per `(code, el)` tuple. When no element is
 * provided, dedupes globally on `code` alone.
 */
export function warnOnce(payload: WarnOncePayload, el?: ElementRef): void {
  if (el === undefined) {
    if (globalWarnings.has(payload.code)) return;
    globalWarnings.add(payload.code);
  } else {
    let set = elementWarnings.get(el);
    if (!set) {
      set = new Set();
      elementWarnings.set(el, set);
    }
    if (set.has(payload.code)) return;
    set.add(payload.code);
  }
  console.warn(
    JSON.stringify({
      code: payload.code,
      tier: payload.tier ?? 3,
      subTier: payload.subTier,
      surface: payload.surface,
      message: payload.message ?? '',
      suggestion: payload.suggestion,
      elementUid: el === undefined ? undefined : safeElementUid(el),
      elementTag: el === undefined ? undefined : safeElementTag(el),
    }),
  );
}

function safeElementUid(el: ElementRef): number | undefined {
  try {
    return __GetElementUniqueID(el);
  } catch {
    return undefined;
  }
}

function safeElementTag(el: ElementRef): string | undefined {
  try {
    return __GetTag(el);
  } catch {
    return undefined;
  }
}

/** Test-only — reset all dedupe state. */
export function _resetDiagnosticsForTesting(): void {
  globalWarnings.clear();
  // WeakMap can't be cleared but tests use fresh refs per case.
}
