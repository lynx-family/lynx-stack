// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @lynx-js/vue-runtime
 *
 * Vue 3 custom renderer for Lynx's Background Thread.
 *
 * Usage:
 *   import { createApp, ref, h, defineComponent } from '@lynx-js/vue-runtime'
 *
 * This module re-exports Vue's reactivity / component APIs and provides a
 * custom createApp() that mounts into a ShadowElement tree and flushes DOM
 * operations to the Main Thread via callLepusMethod('vuePatchUpdate', ...).
 */

import {
  nextTick as _vueNextTick,
  createRenderer,
  // Re-export types need explicit imports for isolatedDeclarations
} from '@vue/runtime-core';
import type {
  App,
  Component,
  ComponentPublicInstance,
  ObjectDirective,
} from '@vue/runtime-core';

import { runOnMainThread } from './cross-thread.js';
import { resetRegistry } from './event-registry.js';
import { resetFlushState, scheduleFlush, waitForFlush } from './flush.js';
import { resetFunctionCallState } from './function-call.js';
import {
  MainThreadRef,
  resetMainThreadRefState,
  useMainThreadRef,
} from './main-thread-ref.js';
import { nodeOps, resetNodeOpsState } from './node-ops.js';
import { OP, pushOp, takeOps } from './ops.js';
import {
  resetRunOnBackgroundState,
  runOnBackground,
} from './run-on-background.js';
import { ShadowElement, createPageRoot } from './shadow-element.js';
import { transformToWorklet } from './transform-to-worklet.js';

export type { App, Component, ComponentPublicInstance };

const _renderer = createRenderer<ShadowElement, ShadowElement>(nodeOps);
const _createApp = _renderer.createApp;

// ---------------------------------------------------------------------------
// createApp – mounts immediately when called (main-thread renderPage runs
// before the background bundle is initialised by Lynx, so page root id=1
// is always ready by the time app.mount() executes)
// ---------------------------------------------------------------------------

export interface VueLynxApp {
  mount(): void;
  unmount(): void;
  use(plugin: unknown, ...options: unknown[]): VueLynxApp;
  provide(key: unknown, value: unknown): VueLynxApp;
  config: App['config'];
  [key: string]: unknown;
}

export function createApp(
  rootComponent: Component,
  rootProps?: Record<string, unknown>,
): VueLynxApp {
  const internalApp = _createApp(rootComponent, rootProps);

  const app: VueLynxApp = {
    get config() {
      return internalApp.config;
    },

    use(plugin: unknown, ...options: unknown[]): VueLynxApp {
      internalApp.use(plugin as Parameters<App['use']>[0], ...options);
      return app;
    },

    provide(key: unknown, value: unknown): VueLynxApp {
      internalApp.provide(
        key,
        value,
      );
      return app;
    },

    mount(): void {
      const root = createPageRoot();
      internalApp.mount(root);
    },

    unmount(): void {
      internalApp.unmount();
    },
  };

  return app;
}

// ---------------------------------------------------------------------------
// Re-export commonly used Vue APIs
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// nextTick – patched to wait for the main-thread ops acknowledgement.
//
// Vue's built-in nextTick resolves after the BG scheduler flush cycle, but
// in Lynx's dual-thread model the main thread has not yet applied the ops.
// We chain on waitForFlush() so that user code (e.g. element queries inside
// onMounted + nextTick) sees fully-materialised elements.
// ---------------------------------------------------------------------------

export function nextTick(fn?: () => void): Promise<void> {
  if (fn) {
    return _vueNextTick()
      .then(() => waitForFlush())
      .then(fn);
  }
  return _vueNextTick().then(() => waitForFlush());
}

export {
  // ---------------------------------------------------------------------------
  // Composition API — Reactivity
  // ---------------------------------------------------------------------------
  computed,
  customRef,
  reactive,
  readonly,
  ref,
  shallowReactive,
  shallowRef,
  shallowReadonly,
  toRaw,
  toRef,
  toRefs,
  toValue,
  triggerRef,
  unref,
  isRef,
  isReactive,
  isReadonly,
  isProxy,
  isShallow,
  markRaw,
  // ---------------------------------------------------------------------------
  // Composition API — Lifecycle hooks
  // ---------------------------------------------------------------------------
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onUnmounted,
  onUpdated,
  onErrorCaptured,
  onRenderTracked,
  onRenderTriggered,
  // ---------------------------------------------------------------------------
  // Composition API — Watchers
  // ---------------------------------------------------------------------------
  watch,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
  onWatcherCleanup,
  // ---------------------------------------------------------------------------
  // Composition API — Dependency injection
  // ---------------------------------------------------------------------------
  inject,
  provide,
  // ---------------------------------------------------------------------------
  // Composition API — Scope API
  // ---------------------------------------------------------------------------
  effectScope,
  getCurrentScope,
  onScopeDispose,
  // ---------------------------------------------------------------------------
  // Component utilities
  // ---------------------------------------------------------------------------
  defineAsyncComponent,
  defineComponent,
  getCurrentInstance,
  h,
  useId,
  useModel,
  hasInjectionContext,
  // ---------------------------------------------------------------------------
  // Block / VNode creation (template compiler runtime helpers)
  // ---------------------------------------------------------------------------
  openBlock,
  createBlock,
  createElementBlock,
  createVNode,
  createElementVNode,
  createTextVNode,
  createCommentVNode,
  cloneVNode,
  isVNode,
  // ---------------------------------------------------------------------------
  // VNode type symbols
  // ---------------------------------------------------------------------------
  Fragment,
  Text,
  Comment,
  // ---------------------------------------------------------------------------
  // Interpolation & normalization helpers
  // ---------------------------------------------------------------------------
  toDisplayString,
  normalizeClass,
  normalizeStyle,
  normalizeProps,
  mergeProps,
  camelize,
  capitalize,
  // ---------------------------------------------------------------------------
  // List / conditional / built-in components
  // ---------------------------------------------------------------------------
  renderList,
  Suspense,
  // ---------------------------------------------------------------------------
  // Directives
  // ---------------------------------------------------------------------------
  withDirectives,
  // ---------------------------------------------------------------------------
  // Component resolution
  // ---------------------------------------------------------------------------
  resolveComponent,
  resolveDynamicComponent,
  resolveDirective,
  // ---------------------------------------------------------------------------
  // Slots
  // ---------------------------------------------------------------------------
  withCtx,
  renderSlot,
  useSlots,
  defineSlots,
  createSlots,
  // ---------------------------------------------------------------------------
  // Script setup macros (runtime stubs used in SFCs)
  // ---------------------------------------------------------------------------
  defineProps,
  defineEmits,
  defineExpose,
  defineOptions,
  defineModel,
  withDefaults,
  useAttrs,
  useTemplateRef,
  // ---------------------------------------------------------------------------
  // Template compiler helpers (SFC compiler output references these)
  // ---------------------------------------------------------------------------
  withMemo,
  setBlockTracking,
  pushScopeId,
  popScopeId,
  withScopeId,
  toHandlerKey,
  toHandlers,
  // ---------------------------------------------------------------------------
  // Misc
  // ---------------------------------------------------------------------------
  version,
} from '@vue/runtime-core';

// ---------------------------------------------------------------------------
// Deprecated — SSR APIs (not applicable to Lynx)
// ---------------------------------------------------------------------------

/**
 * @deprecated Lynx has no server-side rendering. This hook will never be called.
 * Use onMounted() for data fetching in Lynx.
 */
export function onServerPrefetch(_fn: () => unknown): void {
  if (__DEV__) {
    console.warn(
      '[vue-lynx] onServerPrefetch is not supported — Lynx has no SSR.',
    );
  }
}

/**
 * @deprecated Lynx has no SSR context. Returns undefined.
 */
export function useSSRContext(): undefined {
  if (__DEV__) {
    console.warn(
      '[vue-lynx] useSSRContext is not available — Lynx has no SSR.',
    );
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Deprecated — renderer features not implemented in Vue Lynx
// ---------------------------------------------------------------------------

/**
 * @deprecated Vue Lynx does not implement `insertStaticContent`.
 * Static VNodes will throw at mount time. Use `h()` / `createVNode()` instead.
 */
export function createStaticVNode(
  _content: string,
  _numberOfNodes: number,
): never {
  throw new Error(
    '[vue-lynx] createStaticVNode is not supported — the Lynx renderer does not implement insertStaticContent.',
  );
}

/**
 * @deprecated Vue Lynx does not implement `insertStaticContent`.
 * Static VNodes cannot be rendered. Use `Text` or `Comment` instead.
 */
export const Static: symbol = Symbol.for('v-stc');

/**
 * @deprecated KeepAlive requires an internal storage container created via
 * `createElement('div')`. In Vue Lynx this creates an orphan element on the
 * Main Thread with no visual tree parent, causing undefined native behaviour.
 * Component caching is not supported.
 */
export function KeepAlive(): void {
  if (__DEV__) {
    console.warn(
      '[vue-lynx] KeepAlive is not supported — Lynx renderer has no element recycling.',
    );
  }
}

/**
 * @deprecated onActivated depends on KeepAlive, which is not supported in Lynx.
 * This hook will never be called. Use onMounted() instead.
 */
export function onActivated(_fn: () => void): void {
  if (__DEV__) {
    console.warn(
      '[vue-lynx] onActivated is not supported — KeepAlive is not available.',
    );
  }
}

/**
 * @deprecated onDeactivated depends on KeepAlive, which is not supported in Lynx.
 * This hook will never be called. Use onUnmounted() instead.
 */
export function onDeactivated(_fn: () => void): void {
  if (__DEV__) {
    console.warn(
      '[vue-lynx] onDeactivated is not supported — KeepAlive is not available.',
    );
  }
}

/**
 * @deprecated Teleport requires `querySelector` renderer option to resolve
 * string targets (e.g. `to="#modal"`). Vue Lynx does not implement
 * `querySelector`. In dev mode, Vue will warn and the content will not be
 * teleported. Direct element references are also unsupported because Lynx
 * native elements are not accessible from the Background Thread.
 */
export function Teleport(): void {
  if (__DEV__) {
    console.warn(
      '[vue-lynx] Teleport is not supported — Lynx renderer has no querySelector.',
    );
  }
}

// ---------------------------------------------------------------------------
// Intentionally NOT re-exported — @vue/runtime-core internal APIs
// ---------------------------------------------------------------------------
// These are implementation details not part of Vue's public API:
//
// Reactivity internals:  effect, ReactiveEffect, stop, proxyRefs,
//                        TrackOpTypes, TriggerOpTypes
// Error internals:       callWithErrorHandling, callWithAsyncErrorHandling,
//                        handleError, ErrorCodes, ErrorTypeStrings
// Dev/debug internals:   warn, devtools, setDevtoolsHook, initCustomFormatter,
//                        registerRuntimeCompiler, DeprecationTypes, compatUtils
// Rendering internals:   isMemoSame, isRuntimeOnly, guardReactiveProps,
//                        transformVNodeArgs, assertNumber
// Transition internals:  BaseTransition, BaseTransitionPropsValidators,
//                        resolveTransitionHooks, setTransitionHooks,
//                        getTransitionRawChildren, useTransitionState
// SSR internals:         ssrContextKey, ssrUtils, createHydrationRenderer
// Hydration (SSR):       hydrateOnIdle, hydrateOnVisible,
//                        hydrateOnMediaQuery, hydrateOnInteraction
// Compat:                resolveFilter
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Stubs for APIs from @vue/runtime-dom that template compiler may reference.
// These depend on real DOM APIs and cannot be used directly in Lynx.
// ---------------------------------------------------------------------------

function applyVShow(el: ShadowElement, value: unknown): void {
  el._vShowHidden = !value;
  const style = el._vShowHidden ? { ...el._style, display: 'none' } : el._style;
  pushOp(OP.SET_STYLE, el.id, style);
  scheduleFlush();
}

export const vShow: ObjectDirective<ShadowElement, unknown> = {
  beforeMount(el, { value }) {
    applyVShow(el, value);
  },
  updated(el, { value, oldValue }) {
    if (value !== oldValue) applyVShow(el, value);
  },
};

/** Lynx stub for vModelText. v-model on inputs is not yet supported. */
export const vModelText = {
  beforeMount() {
    console.warn('[vue-lynx] v-model is not supported yet');
  },
  beforeUpdate() {/* no-op */},
};

/** Lynx stub for vModelCheckbox. */
export const vModelCheckbox = vModelText;

/** Lynx stub for vModelSelect. */
export const vModelSelect = vModelText;

/** Lynx stub for vModelRadio. */
export const vModelRadio = vModelText;

/** Lynx stub for withModifiers (event modifier helper). */
export function withModifiers(
  fn: (...args: unknown[]) => unknown,
  _modifiers: string[],
): (...args: unknown[]) => unknown {
  return fn;
}

/** Lynx stub for withKeys (keyboard event modifier helper). */
export function withKeys(
  fn: (...args: unknown[]) => unknown,
  _keys: string[],
): (...args: unknown[]) => unknown {
  return fn;
}

// ---------------------------------------------------------------------------
// Testing utilities
// ---------------------------------------------------------------------------

export { ShadowElement, nodeOps, takeOps };

// ---------------------------------------------------------------------------
// Main Thread Script (MTS) APIs
// ---------------------------------------------------------------------------

export {
  MainThreadRef,
  useMainThreadRef,
  runOnMainThread,
  runOnBackground,
  transformToWorklet,
};

/**
 * Reset all module-level state between tests.
 * Must be called before each test to ensure isolation.
 */
export function resetForTesting(): void {
  resetRegistry();
  resetNodeOpsState();
  resetFlushState();
  resetMainThreadRefState();
  resetFunctionCallState();
  resetRunOnBackgroundState();
  takeOps(); // drain any leftover ops
  ShadowElement.nextId = 2;
}
