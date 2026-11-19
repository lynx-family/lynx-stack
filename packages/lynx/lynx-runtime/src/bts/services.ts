// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { assertScopeAlive, getScopeLynx } from './scope.js';
import type { BTSPageScope } from './scope.js';
import type {
  HostContextProxy,
  HostGlobalScope,
} from '../common/host-types.js';
import { subscribeMessage } from '../common/messages.js';
import { createHostPipeline, markHostTiming } from '../common/performance.js';
import type {
  CreatePipelineOptions,
  CreatedPipelineOptions,
  LynxSystemInfo,
  PipelineOptions,
  Unsubscribe,
} from '../common/types.js';

/** @internal */
export function scopeGetSystemInfo(
  scope: BTSPageScope,
): Readonly<LynxSystemInfo> {
  const host = globalThis as unknown as HostGlobalScope;
  return (
    getScopeLynx(scope)?.SystemInfo
      ?? host.SystemInfo
      ?? host.lynx?.SystemInfo
      ?? {}
  );
}

/** @internal */
export function scopeCreatePipeline(
  scope: BTSPageScope,
  options?: CreatePipelineOptions,
): CreatedPipelineOptions | undefined {
  if (scope.destroyed) return undefined;
  return createHostPipeline(
    getScopeLynx(scope)?.performance,
    options,
    'bts',
    scopeGetSystemInfo(scope).lynxSdkVersion,
  );
}

/** @internal */
export function scopeMarkTiming(
  scope: BTSPageScope,
  pipeline: string | PipelineOptions | undefined,
  timingKey: string,
): void {
  if (scope.destroyed) return;
  markHostTiming(getScopeLynx(scope)?.performance, pipeline, timingKey);
}

function getCoreContext(scope: BTSPageScope): HostContextProxy {
  const proxy = getScopeLynx(scope)?.getCoreContext?.();
  if (!proxy) {
    throw new Error(
      '[@lynx-js/lynx-runtime/bts] Message communication requires lynx.getCoreContext(). Ensure the BTS host context is initialized before calling sendMessage() or onMessage().',
    );
  }
  return proxy;
}

/** @internal */
export function scopeSendMessage<T>(
  scope: BTSPageScope,
  type: string,
  data?: T,
): void {
  assertScopeAlive(scope);
  getCoreContext(scope).dispatchEvent({ type, data });
}

/** @internal */
export function scopeOnMessage<T>(
  scope: BTSPageScope,
  type: string,
  listener: (this: void, data: T) => void,
): Unsubscribe {
  assertScopeAlive(scope);
  const proxy = getCoreContext(scope);
  scope.messages ??= new Map();
  return subscribeMessage(scope.messages, proxy, type, listener);
}
