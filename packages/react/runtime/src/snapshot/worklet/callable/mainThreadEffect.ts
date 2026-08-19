// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { addCallableCtxPatch, addCallableRunPatch } from './callablePool.js';
import {
  allocateCallableIdBG,
  isMainThreadFunction,
  reportInvalidMainThreadFunction,
} from './mainThreadEvent.js';
import { useEffect, useRef } from '../../../core/hooks/react.js';
import { onPostWorkletCtx } from '../ctx.js';

interface EffectState {
  id: number;
  prevDeps: readonly unknown[] | undefined;
  hasRun: boolean;
}

function depsChanged(state: EffectState, deps: readonly unknown[] | undefined): boolean {
  if (!state.hasRun || deps === undefined) {
    return true;
  }
  const prevDeps = state.prevDeps;
  if (prevDeps === undefined || prevDeps.length !== deps.length) {
    return true;
  }
  return deps.some((dep, i) => !Object.is(dep, prevDeps[i]));
}

/**
 * Run a main-thread function synchronized with the commit: after this
 * commit's patch is applied on the main thread, and before the next paint of
 * that state — the main-thread counterpart of `useLayoutEffect`.
 *
 * - The effect runs on the main thread whenever `deps` change (or on every
 *   committed render when `deps` is omitted), observing the committed element
 *   state of the same commit. Captured values are a snapshot of the render
 *   that scheduled the run.
 * - The effect may return a cleanup function. The cleanup runs on the main
 *   thread before the next run of the effect, and when the component
 *   unmounts.
 * - On unmount, the pending cleanup and the release are flushed after the
 *   unmounting commit's patch, and a run scheduled in the same commit as a
 *   release is cancelled.
 * - The effect does not run during first-screen rendering; the first run
 *   happens with the hydration commit, like React effects.
 *
 * It is a hook and it should only be called at the top level of your component.
 *
 * @param fn - The main-thread function to run.
 * @param deps - The dependency array gating the run, with `useEffect`
 * semantics.
 *
 * @example
 *
 * ```tsx
 * import { useMainThreadEffect } from '@lynx-js/react'
 *
 * function MyMotionComponent(props) {
 *   useMainThreadEffect(() => {
 *     'main thread'
 *     const controls = startAnimation(props.animate)
 *     return () => {
 *       'main thread'
 *       controls.stop()
 *     }
 *   }, [props.animate])
 *   // ...
 * }
 * ```
 *
 * @public
 */
export function useMainThreadEffect(
  fn: (() => void | (() => void)) | null | undefined,
  deps?: readonly unknown[],
): void {
  const stateRef = useRef<EffectState | null>(null);

  let mainThreadFn: (() => void | (() => void)) | null = fn ?? null;
  if (mainThreadFn !== null && !isMainThreadFunction(mainThreadFn)) {
    reportInvalidMainThreadFunction('useMainThreadEffect', mainThreadFn);
    mainThreadFn = null;
  }

  // The effect does not run during first-screen (main thread) rendering;
  // like React effects, the first run happens with the hydration commit.
  if (__JS__ && mainThreadFn !== null) {
    stateRef.current ??= {
      id: allocateCallableIdBG(),
      prevDeps: undefined,
      hasRun: false,
    };
    const state = stateRef.current;
    if (depsChanged(state, deps)) {
      const ctx = onPostWorkletCtx({ ...(mainThreadFn as unknown as Worklet) });
      if (ctx) {
        state.prevDeps = deps;
        state.hasRun = true;
        addCallableCtxPatch(state.id, ctx);
        addCallableRunPatch(state.id);
      }
    }
  }

  useEffect(() => {
    return () => {
      if (stateRef.current !== null) {
        addCallableCtxPatch(stateRef.current.id, null);
      }
    };
  }, []);
}
