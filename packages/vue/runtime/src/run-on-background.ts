// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * runOnBackground — BG-side registration and event handling.
 *
 * When a worklet context containing `runOnBackground(fn)` is sent to the Main
 * Thread, we register it here so the BG thread can look up and invoke the
 * original JS function when the MT dispatches 'Lynx.Worklet.runOnBackground'.
 *
 * Ported from React Lynx's execMap.ts + runOnBackground.ts + indexMap.ts.
 */

import type { JsFnHandle, Worklet } from './worklet-types.js';

const RUN_ON_BACKGROUND = 'Lynx.Worklet.runOnBackground';
const FUNCTION_CALL_RET = 'Lynx.Worklet.FunctionCallRet';

// ---------------------------------------------------------------------------
// IndexMap — auto-incrementing Map (port of React's indexMap.ts)
// ---------------------------------------------------------------------------

class IndexMap<T> {
  private lastIndex = 0;
  private map = new Map<number, T>();

  add(value: T): number {
    const id = ++this.lastIndex;
    this.map.set(id, value);
    return id;
  }

  get(index: number): T | undefined {
    return this.map.get(index);
  }

  remove(index: number): void {
    this.map.delete(index);
  }
}

// ---------------------------------------------------------------------------
// WorkletExecIdMap — stamps _execId, finds JsFnHandle by (execId, fnId)
// ---------------------------------------------------------------------------

class WorkletExecIdMap extends IndexMap<Worklet> {
  override add(worklet: Worklet): number {
    const execId = super.add(worklet);
    worklet._execId = execId;
    return execId;
  }

  findJsFnHandle(execId: number, fnId: number): JsFnHandle | undefined {
    const worklet = this.get(execId);
    if (!worklet) return undefined;

    const visited = new Set<object>();
    const search = (value: unknown): JsFnHandle | undefined => {
      if (value === null || typeof value !== 'object') return undefined;
      const obj = value as Record<string, unknown>;
      if (visited.has(obj)) return undefined;
      visited.add(obj);
      if ('_jsFnId' in obj && obj['_jsFnId'] === fnId) {
        return obj as JsFnHandle;
      }
      for (const key in obj) {
        const result = search(obj[key]);
        if (result) return result;
      }
      return undefined;
    };

    return search(worklet);
  }
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let execIdMap: WorkletExecIdMap | undefined;

// ---------------------------------------------------------------------------
// registerWorkletCtx — call before sending worklet ctx to MT via ops
// ---------------------------------------------------------------------------

export function registerWorkletCtx(ctx: Worklet): void {
  if (!execIdMap) init();
  execIdMap!.add(ctx);
}

// ---------------------------------------------------------------------------
// init — lazily set up the event listener
// ---------------------------------------------------------------------------

function init(): void {
  execIdMap = new WorkletExecIdMap();
  lynx.getCoreContext().addEventListener(RUN_ON_BACKGROUND, runJSFunction);
}

// ---------------------------------------------------------------------------
// runJSFunction — receives MT dispatch, finds _fn, calls it, returns value
// ---------------------------------------------------------------------------

interface RunOnBackgroundData {
  obj: { _jsFnId: number; _execId: number };
  params: unknown[];
  resolveId: number;
}

function runJSFunction(event: { data?: unknown }): void {
  const data = JSON.parse(event.data as string) as RunOnBackgroundData;
  const handle = execIdMap!.findJsFnHandle(
    data.obj._execId,
    data.obj._jsFnId,
  );
  if (!handle?._fn) {
    throw new Error(
      `runOnBackground: JS function not found (execId=${data.obj._execId}, fnId=${data.obj._jsFnId})`,
    );
  }
  const returnValue = handle._fn(...data.params);
  lynx.getCoreContext().dispatchEvent({
    type: FUNCTION_CALL_RET,
    data: JSON.stringify({ resolveId: data.resolveId, returnValue }),
  });
}

// ---------------------------------------------------------------------------
// Stub for user-side import (SWC replaces all call sites)
// ---------------------------------------------------------------------------

/**
 * Call a Background Thread function from a `'main thread'` worklet.
 *
 * At build time the SWC transform replaces all `runOnBackground(fn)` call
 * sites. This export exists only for TypeScript import resolution — it is
 * never called at runtime on the BG thread.
 */
export function runOnBackground<R, Fn extends (...args: unknown[]) => R>(
  _fn: Fn,
): (...args: Parameters<Fn>) => Promise<R> {
  throw new Error(
    'runOnBackground() can only be used inside \'main thread\' functions. '
      + 'The SWC worklet transform should replace this call at build time.',
  );
}

// ---------------------------------------------------------------------------
// Reset — for testing only
// ---------------------------------------------------------------------------

export function resetRunOnBackgroundState(): void {
  execIdMap = undefined;
}
