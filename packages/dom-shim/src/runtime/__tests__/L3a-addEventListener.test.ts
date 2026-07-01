// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShimEvent, fireEvent } from '../events.ts';
import { L3aEventfulElement, wrapPapi } from '../nodes.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  events: Array<{ type: string; name: string; func: unknown }>;
}

function mk(): MockEl {
  return { tag: 'view', events: [] };
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__AddEvent'] = (
    n: MockEl,
    type: string,
    name: string,
    func: unknown,
  ) => {
    n.events.push({ type, name, func });
  };
  g['__FlushElementTree'] = () => undefined;
}

describe('US-432 addEventListener with multiplex trampoline', () => {
  beforeEach(() => {
    installPapi();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wrapPapi returns L3aEventfulElement for non-text', () => {
    const e = wrapPapi(mk());
    expect(e).toBeInstanceOf(L3aEventfulElement);
  });

  it('first addEventListener registers a trampoline via __AddEvent', () => {
    const ref = mk();
    const e = wrapPapi(ref) as L3aEventfulElement;
    e.addEventListener('click', () => undefined);
    expect(ref.events).toHaveLength(1);
    expect(ref.events[0]?.type).toBe('click');
    expect(ref.events[0]?.name).toBe('__shim_trampoline__click');
  });

  it('subsequent addEventListener calls do NOT re-register PAPI', () => {
    const ref = mk();
    const e = wrapPapi(ref) as L3aEventfulElement;
    e.addEventListener('click', () => undefined);
    e.addEventListener('click', () => undefined);
    e.addEventListener('click', () => undefined);
    expect(ref.events).toHaveLength(1);
  });

  it('fires all listeners in registration order', () => {
    const ref = mk();
    const e = wrapPapi(ref) as L3aEventfulElement;
    const log: string[] = [];
    e.addEventListener('click', () => log.push('a'));
    e.addEventListener('click', () => log.push('b'));
    e.addEventListener('click', () => log.push('c'));
    fireEvent(ref, 'click');
    expect(log).toEqual(['a', 'b', 'c']);
  });

  it('spec dedupe: same (fn, capture) added twice → only one listener', () => {
    const ref = mk();
    const e = wrapPapi(ref) as L3aEventfulElement;
    let calls = 0;
    const handler = (): void => {
      calls++;
    };
    e.addEventListener('click', handler);
    e.addEventListener('click', handler);
    e.addEventListener('click', handler);
    fireEvent(ref, 'click');
    expect(calls).toBe(1);
  });

  it('same fn with different capture is NOT a duplicate', () => {
    const ref = mk();
    const e = wrapPapi(ref) as L3aEventfulElement;
    let calls = 0;
    const handler = (): void => {
      calls++;
    };
    e.addEventListener('click', handler);
    e.addEventListener('click', handler, { capture: true });
    fireEvent(ref, 'click');
    expect(calls).toBe(2);
  });

  it('AbortSignal removes the listener on abort', () => {
    const ref = mk();
    const e = wrapPapi(ref) as L3aEventfulElement;
    const controller = new AbortController();
    let calls = 0;
    e.addEventListener('click', () => calls++, { signal: controller.signal });
    fireEvent(ref, 'click');
    expect(calls).toBe(1);
    controller.abort();
    fireEvent(ref, 'click');
    expect(calls).toBe(1);
  });

  it('listener receives a ShimEvent with type set', () => {
    const ref = mk();
    const e = wrapPapi(ref) as L3aEventfulElement;
    let captured: unknown;
    e.addEventListener('click', (ev) => {
      captured = ev;
    });
    fireEvent(ref, 'click');
    expect(captured).toBeInstanceOf(ShimEvent);
    expect((captured as ShimEvent).type).toBe('click');
  });

  it('listener errors do not abort other listeners', () => {
    const ref = mk();
    const e = wrapPapi(ref) as L3aEventfulElement;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() =>
      undefined
    );
    let bRan = false;
    e.addEventListener('click', () => {
      throw new Error('boom');
    });
    e.addEventListener('click', () => {
      bRan = true;
    });
    fireEvent(ref, 'click');
    expect(bRan).toBe(true);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('dispatchEvent throws L4', () => {
    const e = wrapPapi(mk()) as L3aEventfulElement;
    expect(() => e.dispatchEvent(new ShimEvent('click'))).toThrow(
      /dispatchEvent/,
    );
  });
});
