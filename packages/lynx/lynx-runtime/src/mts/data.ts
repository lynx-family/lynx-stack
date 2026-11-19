// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  defaultGetPageData,
  defaultProcessData,
  getAliveMTSState,
  initMTSHostState,
} from './host.js';
import type { MTSSingleOwnerKey } from './host.js';
import type { HostGlobalScope } from '../common/host-types.js';
import { copyHostData, subscribeListener } from '../common/protocol.js';
import type {
  MTSFlushContext,
  MTSReloadOptions,
  MTSRenderOptions,
  MTSUpdateOptions,
  Unsubscribe,
} from '../common/types.js';

function registerSingleOwnerSlot<
  K extends MTSSingleOwnerKey,
  TFn extends NonNullable<HostGlobalScope[K]>,
>(
  slotKey: K,
  defaultFn: TFn,
  handler: TFn,
): Unsubscribe {
  const host = globalThis as unknown as HostGlobalScope;
  const state = getAliveMTSState(host);
  state.slots[slotKey] = handler;
  host[slotKey] = handler;
  return () => {
    if (state.slots[slotKey] !== handler) {
      return;
    }
    state.slots[slotKey] = undefined;
    if (host[slotKey] === handler) {
      host[slotKey] = defaultFn;
    }
  };
}

/**
 * Read a detached copy of the initial page data records and arrays on MTS.
 * Opaque objects remain shared by reference.
 * Updated on first-screen `renderPage` and on `reloadTemplate` updates,
 * and isolated from runtime mutations to `lynx.__initData`.
 * Ensure the MTS runtime is initialized during synchronous bootstrap before the
 * first host input arrives; incremental updates do not change this baseline.
 * Remains readable after destruction.
 */
export function getInitData<T = Record<string, unknown>>(): T {
  const state = initMTSHostState(globalThis as unknown as HostGlobalScope);
  return copyHostData(state.initData) as T;
}

/**
 * Borrow the current host `GlobalProps` without copying (defaults to `{}` when unset).
 * Treat the entire value as read-only, including nested objects; Readonly is shallow
 * and no freeze is applied. If a DSL mutates its own root `GlobalProps` object in place
 * (e.g. `Object.assign`), shallow-copy `{ ...getGlobalProps() }` at startup.
 * During and after destruction, read the captured final properties.
 */
export function getGlobalProps<T = Record<string, unknown>>(): Readonly<T> {
  const host = globalThis as unknown as HostGlobalScope;
  const state = initMTSHostState(host);
  if (state.destroyed) {
    return state.globalProps as Readonly<T>;
  }
  return (host.lynx?.__globalProps ?? state.globalProps) as Readonly<T>;
}

/**
 * Subscribe to first-screen render on MTS.
 * Register synchronously before the first host input.
 * Input is read-only and not replayed. The host submits the first screen on return.
 */
export function onRenderPage<T = Record<string, unknown>>(
  listener: (data: Readonly<T>, options: Readonly<MTSRenderOptions>) => void,
): Unsubscribe {
  const state = getAliveMTSState(globalThis as unknown as HostGlobalScope);
  return subscribeListener(
    state.renderListeners,
    listener as (
      data: Record<string, unknown>,
      options: MTSRenderOptions,
    ) => void,
  );
}

/**
 * Subscribe to host page data updates and resets on MTS (`!options.reloadTemplate`).
 * `resetPageData` replaces current data rather than merging an incremental update.
 * Preserve these options with the work and pass them to `flushElementTree` when
 * submitting its changes.
 * Register before host input; input is read-only, not replayed, and not automatically merged into DSL state.
 */
export function onUpdateData<T = Record<string, unknown>>(
  listener: (data: Readonly<T>, options: Readonly<MTSUpdateOptions>) => void,
): Unsubscribe {
  const state = getAliveMTSState(globalThis as unknown as HostGlobalScope);
  return subscribeListener(
    state.updateListeners,
    listener as (
      data: Record<string, unknown>,
      options: MTSUpdateOptions,
    ) => void,
  );
}

/**
 * Subscribe to host template reloads on MTS (`options.reloadTemplate === true`).
 * Runtime refreshes `getInitData()` before invoking reload listeners. Preserve
 * these options with the work and pass them to `flushElementTree` when submitting
 * its changes.
 * Reload does not imply page destruction or cleanup of the previous DSL entry.
 */
export function onReload<T = Record<string, unknown>>(
  listener: (data: Readonly<T>, options: Readonly<MTSReloadOptions>) => void,
): Unsubscribe {
  const state = getAliveMTSState(globalThis as unknown as HostGlobalScope);
  return subscribeListener(
    state.reloadListeners,
    listener as (
      data: Record<string, unknown>,
      options: MTSReloadOptions,
    ) => void,
  );
}

/**
 * Subscribe to host `GlobalProps` updates on MTS.
 * Treat the delivered object as read-only; mutating it affects shared host state.
 * Notifications are not replayed. Pass options to flushElementTree after applying
 * the update, including updates that leave the element tree unchanged.
 */
export function onGlobalPropsChanged<T = Record<string, unknown>>(
  listener: (
    globalProps: Readonly<T>,
    options?: Readonly<MTSFlushContext>,
  ) => void,
): Unsubscribe {
  const state = getAliveMTSState(globalThis as unknown as HostGlobalScope);
  return subscribeListener(
    state.globalPropsListeners,
    listener as (
      globalProps: Record<string, unknown>,
      options?: MTSFlushContext,
    ) => void,
  );
}

/**
 * Register the synchronous single-owner MTS host `processData` hook.
 * Native consumes its return value immediately; PromiseLike results are rejected.
 * Normalizes Native's absent `TemplateData` (`undefined` / `null`) to `{}` and
 * empty default `processorName` (`""`) to `undefined` across Native and Web.
 * Registering a new processor replaces the previous active processor; unsubscribing
 * the active processor or destroying the page restores the identity processor.
 * Install before the host processes its first input; it cannot retroactively process
 * earlier data. Disposing a replaced registration does not affect the current owner.
 */
export function setDataProcessor<
  TInput = Record<string, unknown>,
  TOutput = Record<string, unknown>,
>(
  processor: (
    data: TInput,
    processorName?: string,
  ) => TOutput & ({ then?: never } | null | undefined),
): Unsubscribe {
  return registerSingleOwnerSlot(
    'processData',
    defaultProcessData,
    (data: unknown, processorName?: string): unknown =>
      processor(
        (data ?? {}) as TInput,
        processorName === '' ? undefined : processorName,
      ),
  );
}

/**
 * Register the synchronous single-owner MTS `getPageData` hook
 * (PromiseLike results are rejected),
 * invoked by Native `GetCurrentData` / `GetPageDataByKey` to query the DSL's current state.
 * Install before host queries. Latest registration wins; disposing the active getter
 * restores null, not the previous getter. Does not create or maintain DSL state.
 */
export function setPageDataGetter<T = Record<string, unknown>>(
  getter: (keys?: string[]) => (T & { then?: never }) | null,
): Unsubscribe {
  return registerSingleOwnerSlot(
    'getPageData',
    defaultGetPageData,
    (keys?: string[]): unknown => getter(keys),
  );
}
