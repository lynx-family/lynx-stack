// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fireEvent } from '../events.ts';
import { wrapPapi } from '../nodes.ts';
import type { L3aEventfulElement } from '../nodes.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
}

function orphanHandler(): void {
  // top-level handler reference used by removeEventListener no-op test
}

function mk(): MockEl {
  return { tag: 'view' };
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__AddEvent'] = () => undefined;
  g['__FlushElementTree'] = () => undefined;
}

describe('US-433 removeEventListener and once option', () => {
  beforeEach(() => {
    installPapi();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('removeEventListener', () => {
    it('removed handler no longer fires', () => {
      const ref = mk();
      const e = wrapPapi(ref) as L3aEventfulElement;
      let calls = 0;
      const handler = (): void => {
        calls++;
      };
      e.addEventListener('click', handler);
      fireEvent(ref, 'click');
      expect(calls).toBe(1);
      e.removeEventListener('click', handler);
      fireEvent(ref, 'click');
      expect(calls).toBe(1);
    });

    it('removing only matches (fn, capture)', () => {
      const ref = mk();
      const e = wrapPapi(ref) as L3aEventfulElement;
      let calls = 0;
      const handler = (): void => {
        calls++;
      };
      e.addEventListener('click', handler);
      e.addEventListener('click', handler, { capture: true });
      // Remove only the capture listener. The bubble listener remains
      // and fires once on dispatch.
      e.removeEventListener('click', handler, { capture: true });
      fireEvent(ref, 'click');
      expect(calls).toBe(1);
    });

    it('remove unknown handler is a no-op', () => {
      const e = wrapPapi(mk()) as L3aEventfulElement;
      expect(() => e.removeEventListener('click', orphanHandler)).not
        .toThrow();
    });

    it('boolean capture argument is accepted', () => {
      const ref = mk();
      const e = wrapPapi(ref) as L3aEventfulElement;
      let calls = 0;
      const handler = (): void => {
        calls++;
      };
      e.addEventListener('click', handler, true);
      e.removeEventListener('click', handler, true);
      fireEvent(ref, 'click');
      expect(calls).toBe(0);
    });
  });

  describe('once option', () => {
    it('fires once then auto-removes', () => {
      const ref = mk();
      const e = wrapPapi(ref) as L3aEventfulElement;
      let calls = 0;
      e.addEventListener('click', () => calls++, { once: true });
      fireEvent(ref, 'click');
      fireEvent(ref, 'click');
      fireEvent(ref, 'click');
      expect(calls).toBe(1);
    });

    it('coexists with non-once listeners', () => {
      const ref = mk();
      const e = wrapPapi(ref) as L3aEventfulElement;
      let onceCalls = 0;
      let stickyCalls = 0;
      e.addEventListener('click', () => onceCalls++, { once: true });
      e.addEventListener('click', () => stickyCalls++);
      fireEvent(ref, 'click');
      fireEvent(ref, 'click');
      expect(onceCalls).toBe(1);
      expect(stickyCalls).toBe(2);
    });
  });
});
