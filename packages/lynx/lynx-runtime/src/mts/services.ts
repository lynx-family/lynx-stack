// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getAliveMTSState, isMTSHostDestroyed } from './host.js';
import type { MTSHostState } from './host.js';
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

function resolveSystemInfo(host: HostGlobalScope): LynxSystemInfo {
  return host.lynx?.SystemInfo ?? host.SystemInfo ?? {};
}

function getJSContext(
  host: HostGlobalScope,
  state: MTSHostState,
): HostContextProxy {
  let proxy = state.jsContext;
  if (!proxy) {
    proxy = host.lynx?.getJSContext?.();
    if (!proxy) {
      throw new Error(
        '[@lynx-js/lynx-runtime/mts] Message communication requires lynx.getJSContext(). Ensure the MTS host context is initialized before calling sendMessage() or onMessage().',
      );
    }
    state.jsContext = proxy;
  }
  return proxy;
}

/** Read live host environment information without initializing MTS input bindings. */
export function getSystemInfo(): Readonly<LynxSystemInfo> {
  const host = globalThis as unknown as HostGlobalScope;
  if (!isMTSHostDestroyed(host) && host.lynx?.SystemInfo && !host.SystemInfo) {
    // Native UpdateScreenMetrics updates global `SystemInfo.pixelRatio` in place.
    host.SystemInfo = host.lynx.SystemInfo;
  }
  return resolveSystemInfo(host);
}

/** Create a host performance pipeline without imposing DSL timing stages. */
export function createPipeline(
  options?: CreatePipelineOptions,
): CreatedPipelineOptions | undefined {
  const host = globalThis as unknown as HostGlobalScope;
  if (isMTSHostDestroyed(host)) return undefined;
  return createHostPipeline(host.lynx?.performance, options, 'mts');
}

/** Mark a host timing key; the DSL decides whether a key needs timestamps. */
export function markTiming(
  pipeline: string | PipelineOptions | undefined,
  timingKey: string,
): void {
  const host = globalThis as unknown as HostGlobalScope;
  if (isMTSHostDestroyed(host)) return;
  markHostTiming(host.lynx?.performance, pipeline, timingKey);
}

/**
 * Send a named message to this page's BTS without a completion receipt.
 * Requires a live MTS host and peer proxy. Install the receiver first: there is
 * no startup queue, retry, RPC, or cross-type ordering guarantee. Awaiting this
 * void return does not wait for the peer. T does not validate the payload at runtime.
 */
export function sendMessage<T = undefined>(
  type: string,
  ...args: undefined extends T ? [data?: T] : [data: T]
): void;
export function sendMessage(type: string, data?: unknown): void {
  const host = globalThis as unknown as HostGlobalScope;
  const state = getAliveMTSState(host);
  getJSContext(host, state).dispatchEvent({ type, data });
}

/**
 * Subscribe to named messages from this page's BTS, preserving the raw payload.
 * Requires a live host and peer proxy; missed messages are not replayed. Identical
 * callbacks for a type share a registration. Dispose when the owning entry retires;
 * observed page destruction also removes listeners. T is not runtime validation.
 */
export function onMessage<T = unknown>(
  type: string,
  listener: (this: void, data: T) => void,
): Unsubscribe {
  const host = globalThis as unknown as HostGlobalScope;
  const state = getAliveMTSState(host);
  const proxy = getJSContext(host, state);
  state.messages ??= new Map();
  return subscribeMessage(state.messages, proxy, type, listener);
}
