// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { bindPage } from '@lynx-js/lynx-runtime/bts';
import { isDestroyed as isMtsDestroyed, onMessage as onMtsMessage } from '@lynx-js/lynx-runtime/mts';

import { IndexMap } from '../../shared/index-map.js';
import { WorkletEvents } from '../../worklet-runtime/bindings/events.js';
import type { RunWorkletCtxRetData } from '../../worklet-runtime/bindings/events.js';
import { cardLifetime } from '../card-lifetime.js';
import { onReloadScopedMessage } from '../reload-scoped-event.js';
import { registerDestroyTask } from '../runtime-destroy.js';

let resolveMap: IndexMap<(value: any) => void> | undefined;
let cleanupReturnValueListener: (() => void) | undefined;
let unregisterReturnValueCleanup: (() => void) | undefined;

function initReturnValueListener(): void {
  const subscribe = __JS__ ? bindPage().onMessage : onMtsMessage;
  resolveMap = new IndexMap(cardLifetime('functionCallId', () => ({ lastIndex: 0 })));
  const unsub = onReloadScopedMessage(subscribe, WorkletEvents.FunctionCallRet, onFunctionCallRet);

  cleanupReturnValueListener = () => {
    unsub();
    resolveMap = undefined;
    cleanupReturnValueListener = undefined;
  };
}

/**
 * @internal
 */
export function onFunctionCall(resolve: (value: any) => void): number {
  if (__JS__ ? bindPage().isDestroyed() : isMtsDestroyed()) {
    return 0;
  }
  ensureFunctionCallReturnCleanup();
  if (!resolveMap) {
    initReturnValueListener();
  }
  return resolveMap!.add(resolve);
}

function ensureFunctionCallReturnCleanup(): void {
  if (unregisterReturnValueCleanup) {
    return;
  }
  unregisterReturnValueCleanup = registerDestroyTask(() => {
    resetFunctionCallReturnListener();
  });
}

export function resetFunctionCallReturnListener(): void {
  cleanupReturnValueListener?.();
  unregisterReturnValueCleanup?.();
  unregisterReturnValueCleanup = undefined;
}

export function dropFunctionCallReturnIds(resolveIds: readonly number[]): void {
  if (!resolveMap) {
    return;
  }
  for (const resolveId of resolveIds) {
    resolveMap.remove(resolveId);
  }
  if (resolveMap.size === 0) {
    resetFunctionCallReturnListener();
  }
}

function onFunctionCallRet(data: RunWorkletCtxRetData): void {
  const resolve = resolveMap!.get(data.resolveId);
  if (!resolve) {
    return;
  }
  resolveMap!.remove(data.resolveId);
  resolve(data.returnValue);
}
