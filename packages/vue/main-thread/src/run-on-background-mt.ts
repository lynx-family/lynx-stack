// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * MT-side runOnBackground — dispatches function calls from the Main Thread
 * to the Background Thread via 'Lynx.Worklet.runOnBackground' events.
 *
 * Called inside extracted worklet bodies on the Main Thread. The SWC LEPUS
 * pass generates `runOnBackground(_jsFnK)` calls that resolve to this global.
 */

const RUN_ON_BACKGROUND = 'Lynx.Worklet.runOnBackground';
const FUNCTION_CALL_RET = 'Lynx.Worklet.FunctionCallRet';

// ---------------------------------------------------------------------------
// Return value resolver (MT-side, mirrors BG's function-call.ts)
// ---------------------------------------------------------------------------

let resolveMap: Map<number, (v: unknown) => void> | undefined;
let nextResolveId = 1;

function initReturnListener(): void {
  resolveMap = new Map();
  lynx.getJSContext().addEventListener(
    FUNCTION_CALL_RET,
    (event: { data?: unknown }) => {
      const { resolveId, returnValue } = JSON.parse(
        event.data as string,
      ) as { resolveId: number; returnValue: unknown };
      const resolve = resolveMap!.get(resolveId);
      if (resolve) {
        resolveMap!.delete(resolveId);
        resolve(returnValue);
      }
    },
  );
}

// ---------------------------------------------------------------------------
// dispatch — send the event to BG thread
// ---------------------------------------------------------------------------

function dispatch(
  fnId: number,
  params: unknown[],
  execId: number,
  resolveId: number,
): void {
  lynx.getJSContext().dispatchEvent({
    type: RUN_ON_BACKGROUND,
    data: JSON.stringify({
      obj: { _jsFnId: fnId, _execId: execId },
      params,
      resolveId,
    }),
  });
}

// ---------------------------------------------------------------------------
// runOnBackground — the global function called in extracted LEPUS code
// ---------------------------------------------------------------------------

interface JsFnHandle {
  _jsFnId?: number;
  _execId?: number;
  _isFirstScreen?: boolean;
  _error?: string;
}

interface LynxWorkletImpl {
  _runOnBackgroundDelayImpl?: {
    delayRunOnBackground(
      fnObj: JsFnHandle,
      fn: (fnId: number, execId: number) => void,
    ): void;
  };
}

declare const lynxWorkletImpl: LynxWorkletImpl | undefined;

export function runOnBackground(
  handle: JsFnHandle,
): (...args: unknown[]) => Promise<unknown> {
  return async (...params: unknown[]): Promise<unknown> => {
    return new Promise((resolve) => {
      if (!resolveMap) initReturnListener();
      const resolveId = nextResolveId++;
      resolveMap!.set(resolveId, resolve);

      // First-screen delay (worklet-runtime handles this if needed)
      if (
        handle._isFirstScreen
        && typeof lynxWorkletImpl !== 'undefined'
        && lynxWorkletImpl?._runOnBackgroundDelayImpl
      ) {
        lynxWorkletImpl._runOnBackgroundDelayImpl.delayRunOnBackground(
          handle,
          (fnId: number, execId: number) => {
            dispatch(fnId, params, execId, resolveId);
          },
        );
        return;
      }

      dispatch(handle._jsFnId!, params, handle._execId!, resolveId);
    });
  };
}

/** Reset module state — for testing only. */
export function resetRunOnBackgroundMtState(): void {
  resolveMap = undefined;
  nextResolveId = 1;
}
