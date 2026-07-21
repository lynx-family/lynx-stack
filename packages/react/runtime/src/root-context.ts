// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Per-root runtime state ("register file") management.
 *
 * Historically ReactLynx kept all render state in module-level singletons
 * (`__root`, `__globalSnapshotPatch`, commit task map, delayed event buffers,
 * ...). When multiple pages share one background JS context, those singletons
 * make concurrent roots clobber each other — e.g. two roots' snapshot patches
 * merge into one native stream.
 *
 * Instead of rewriting every hot call site, each state module registers a
 * {@link RootContextSlot} that can save its module-level variables into a
 * {@link RootContext}'s bag and load them back. Switching the current root is
 * then a "register swap": hot paths keep reading the same module-level
 * variables, which always alias the current root's state.
 *
 * Root ownership is threaded through the object graph as well: every
 * `BackgroundSnapshotInstance` is stamped with its owning context at
 * construction, and a Preact `renderComponent` hook re-establishes the owner
 * context before each component re-render (see `contextSwitchHook.ts`), so
 * state stays consistent even when Preact's scheduler interleaves components
 * of different roots in one flush.
 */

/**
 * A slot connecting one module's per-root state to the context switcher.
 * @internal
 */
export interface RootContextSlot {
  /** Unique key of this slot in a context's bag. */
  id: string;
  /** Produce the initial state for a freshly created context. */
  init(): unknown;
  /** Save the module-level state into `bag`. */
  save(bag: Record<string, unknown>): void;
  /** Restore the module-level state from `bag`. */
  load(bag: Record<string, unknown>): void;
}

const slots: RootContextSlot[] = [];

/**
 * Register a per-root state slot. Called once at module initialization by
 * each module that owns per-root state.
 * @internal
 */
export function registerContextSlot(slot: RootContextSlot): void {
  // Multi-card support is opt-in at build time; without it the runtime keeps
  // exactly one root and no slot ever needs saving or loading.
  if (typeof __MULTI_CARD__ === 'undefined' || !__MULTI_CARD__) {
    return;
  }
  slots.push(slot);
}

/**
 * The subset of a card's native app used for a root's outgoing messages.
 * @public
 */
export interface RootNativeApp {
  callLepusMethod(name: string, data: object, callback?: (ret?: unknown) => void): void;
}

/**
 * The subset of a card's `lynx` object used by a root.
 * @public
 */
export interface RootLynx {
  getNativeApp(): RootNativeApp;
}

/**
 * The native-facing handler surface of a card's `lynxCoreInject.tt` object.
 * @public
 */
export interface RootTT {
  OnLifecycleEvent?: (...args: any[]) => void;
  publishEvent?: (handlerName: string, data: any) => void;
  publicComponentEvent?: (componentId: string, handlerName: string, data: any) => void;
  callDestroyLifetimeFun?: () => void;
  updateGlobalProps?: (newData: any) => void;
  updateCardData?: (...args: any[]) => void;
  onAppReload?: (...args: any[]) => void;
  processCardConfig?: (...args: any[]) => void;
}

/**
 * The per-root state bag plus the root's native channels.
 * @internal
 */
export class RootContext {
  /** Saved module-level state, keyed by slot id. */
  bag: Record<string, unknown> = {};

  /**
   * The per-card `lynx` object captured at bootstrap. When set, outgoing
   * messages of this root (`callLepusMethod`) are sent through it instead of
   * the ambient global, so each root talks to its own native view.
   */
  lynx: RootLynx | undefined;

  /**
   * The per-card `lynxCoreInject.tt` object captured at bootstrap. Incoming
   * native calls arrive on this object; handlers injected onto it are bound
   * to this context.
   */
  tt: RootTT | undefined;
}

/**
 * The default context backing the classic singleton `root`. Its state lives
 * in the module-level variables whenever it is current (which is always, in
 * a single-root app), so the traditional path pays no overhead.
 * @internal
 */
export const defaultRootContext: RootContext = new RootContext();

let currentRootContext = defaultRootContext;

/**
 * @internal
 */
export function getCurrentRootContext(): RootContext {
  return currentRootContext;
}

/**
 * Swap the module-level per-root state ("registers") to `next`'s.
 * @internal
 */
export function switchRootContext(next: RootContext): void {
  if (next === currentRootContext) {
    return;
  }
  const oldBag = currentRootContext.bag;
  for (const slot of slots) {
    slot.save(oldBag);
  }
  const newBag = next.bag;
  for (const slot of slots) {
    if (!(slot.id in newBag)) {
      newBag[slot.id] = slot.init();
    }
    slot.load(newBag);
  }
  currentRootContext = next;
}
