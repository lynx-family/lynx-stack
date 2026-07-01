// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ElementRef } from './papi-types.ts';

/**
 * Three error/warning classes that the Shim emits at boundary points.
 * See Shim_Design.md Appendix A. The LLM agent loop in Phase 6 consumes
 * the structured shape to repair its output.
 */

/** Spec-shaped diagnostic position. */
export interface DiagnosticPosition {
  file: string;
  line: number;
  column: number;
}

export interface DiagnosticPayload {
  /** Stable diagnostic code, e.g. 'L4/shadow-dom'. */
  code: string;
  /** Tier: 1, 2, 3, or 4. */
  tier: 1 | 2 | 3 | 4;
  /** Optional sub-tier 'a' / 'b' (L3a / L3b). */
  subTier?: 'a' | 'b';
  /** Source-shaped API surface, e.g. 'Element.attachShadow'. */
  surface: string;
  /** Human-readable message. */
  message: string;
  /** Suggested alternative for callers / LLM agents. */
  suggestion?: string;
  /** Best-effort source position from the call site. */
  position?: DiagnosticPosition | null;
  /** PAPI element uid if applicable. */
  elementUid?: number;
  /** Lynx tag if applicable. */
  elementTag?: string;
}

/**
 * Best-effort source-position extraction from the throwing call site.
 * Parses the second stack frame (frame 0 is the constructor; frame 1 is
 * the caller).
 */
function captureCallSitePosition(): DiagnosticPosition | null {
  const stack = new Error('marker').stack;
  if (!stack) return null;
  const lines = stack.split('\n');
  // Skip "Error: marker" header + this function's own frame.
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // Common formats:
    //   "    at functionName (/abs/path/file.ts:42:13)"
    //   "    at /abs/path/file.ts:42:13"
    const m = /(?:\(|\s)([^()\s]+):(\d+):(\d+)\)?\s*$/.exec(line);
    if (!m) continue;
    const file = m[1] ?? '<unknown>';
    if (file.includes('runtime/errors.ts')) continue;
    return {
      file,
      line: Number.parseInt(m[2] ?? '0', 10),
      column: Number.parseInt(m[3] ?? '0', 10),
    };
  }
  return null;
}

abstract class DOMShimDiagnostic {
  readonly code: string;
  readonly tier: 1 | 2 | 3 | 4;
  readonly subTier: 'a' | 'b' | undefined;
  readonly surface: string;
  readonly message: string;
  readonly suggestion: string | undefined;
  readonly position: DiagnosticPosition | null;
  readonly elementUid: number | undefined;
  readonly elementTag: string | undefined;

  constructor(payload: DiagnosticPayload) {
    this.code = payload.code;
    this.tier = payload.tier;
    this.subTier = payload.subTier;
    this.surface = payload.surface;
    this.message = payload.message;
    this.suggestion = payload.suggestion;
    this.position = payload.position ?? captureCallSitePosition();
    this.elementUid = payload.elementUid;
    this.elementTag = payload.elementTag;
  }

  toJSON(): DiagnosticPayload {
    return {
      code: this.code,
      tier: this.tier,
      subTier: this.subTier,
      surface: this.surface,
      message: this.message,
      suggestion: this.suggestion,
      position: this.position,
      elementUid: this.elementUid,
      elementTag: this.elementTag,
    };
  }
}

/**
 * Thrown when accessing an L4 surface (Shadow DOM, customElements,
 * MutationObserver, document.cookie, etc.). See Shim_Design.md §8.
 */
export class DOMShimUnsupportedError extends Error {
  readonly diagnostic: DOMShimDiagnosticPublic;

  constructor(payload: Omit<DiagnosticPayload, 'tier'>) {
    super(payload.message);
    this.name = 'DOMShimUnsupportedError';
    this.diagnostic = new DOMShimUnsupportedDiagnostic({
      ...payload,
      tier: 4,
    });
    // Preserve V8 stack
    if ('captureStackTrace' in Error) {
      (Error as { captureStackTrace?: (t: object, c?: unknown) => void })
        .captureStackTrace?.(this, DOMShimUnsupportedError);
    }
  }

  toJSON(): DiagnosticPayload {
    return this.diagnostic.toJSON();
  }
}

class DOMShimUnsupportedDiagnostic extends DOMShimDiagnostic {}

/**
 * Thrown when a spec invariant is violated, e.g. removeChild of a node
 * that is not a child of the receiver. See Shim_Design.md Appendix A.
 */
export class DOMShimInvariantError extends Error {
  readonly diagnostic: DOMShimDiagnosticPublic;

  constructor(payload: Omit<DiagnosticPayload, 'tier'> & { tier?: 1 | 2 | 3 }) {
    super(payload.message);
    this.name = 'DOMShimInvariantError';
    this.diagnostic = new DOMShimInvariantDiagnostic({
      ...payload,
      tier: payload.tier ?? 2,
    });
    if ('captureStackTrace' in Error) {
      (Error as { captureStackTrace?: (t: object, c?: unknown) => void })
        .captureStackTrace?.(this, DOMShimInvariantError);
    }
  }

  toJSON(): DiagnosticPayload {
    return this.diagnostic.toJSON();
  }
}

class DOMShimInvariantDiagnostic extends DOMShimDiagnostic {}

/**
 * Logged (not thrown) when an L3b behavior diverges from spec, e.g.
 * `<script>` skipped in innerHTML. The runtime emits a
 * `console.warn(JSON.stringify(diagnostic.toJSON()))`.
 */
export class DOMShimDivergenceWarning {
  readonly diagnostic: DOMShimDiagnosticPublic;

  constructor(payload: Omit<DiagnosticPayload, 'tier'> & { tier?: 1 | 2 | 3 }) {
    this.diagnostic = new DOMShimDivergenceDiagnostic({
      ...payload,
      tier: payload.tier ?? 3,
    });
  }

  toJSON(): DiagnosticPayload {
    return this.diagnostic.toJSON();
  }

  /** Emit via console.warn as a single JSON line. */
  emit(): void {
    console.warn(JSON.stringify(this.toJSON()));
  }
}

class DOMShimDivergenceDiagnostic extends DOMShimDiagnostic {}

/** Public shape of the diagnostic object. */
export type DOMShimDiagnosticPublic = DOMShimDiagnostic;

/** Helper: extract uid/tag from a PAPI ref for diagnostic payloads. */
export function elementDiagnosticContext(papi: ElementRef): {
  elementUid?: number;
  elementTag?: string;
} {
  try {
    return {
      elementUid: __GetElementUniqueID(papi),
      elementTag: __GetTag(papi),
    };
  } catch {
    return {};
  }
}
