// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

function clearPendingWorkletRuntimeState(impl: typeof globalThis.lynxWorkletImpl): void {
  impl._runOnBackgroundDelayImpl?.clearDelayedBackgroundFunctions?.();
  impl._refImpl?.clearFirstScreenWorkletRefMap?.();
  impl._eventDelayImpl?.clearDelayedWorklets?.(true);
}

/**
 * Retires the current page's worklet-runtime state for an in-place reload or
 * entry re-evaluation on the same main-thread VM.
 *
 * Preserves VM-scoped registrations (`_workletMap`, MainThreadObject
 * definitions, realized object brands, and positive-ID ref entries), while
 * advancing the `runOnBackground` epoch, recreating the lifecycle manager for
 * the next page, and dropping any aborted first-screen refs or queued legacy
 * worklet events.
 */
export function resetWorkletRuntimeForReload(): void {
  const impl = globalThis.lynxWorkletImpl;
  if (!impl) {
    return;
  }
  const manager = impl._jsFunctionLifecycleManager;
  if (manager?.recreate) {
    impl._jsFunctionLifecycleManager = manager.recreate();
  }
  clearPendingWorkletRuntimeState(impl);
}

/**
 * Disposes worklet-runtime state for terminal main-thread destruction
 * (`__DestroyLifetime`).
 *
 * Unlike {@link resetWorkletRuntimeForReload}, this retires the lifecycle
 * manager without allocating a replacement instance.
 */
export function disposeWorkletRuntime(): void {
  const impl = globalThis.lynxWorkletImpl;
  if (!impl) {
    return;
  }
  const manager = impl._jsFunctionLifecycleManager;
  if (manager) {
    manager.dispose?.();
    delete impl._jsFunctionLifecycleManager;
  }
  clearPendingWorkletRuntimeState(impl);
}
