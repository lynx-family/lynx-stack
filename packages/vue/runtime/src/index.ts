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
import { resetFlushState, scheduleFlush } from './flush.js';
import {
  MainThreadRef,
  resetMainThreadRefState,
  useMainThreadRef,
} from './main-thread-ref.js';
import { nodeOps, resetNodeOpsState } from './node-ops.js';
import { OP, pushOp, takeOps } from './ops.js';
import { ShadowElement, createPageRoot } from './shadow-element.js';

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

export {
  // Composition API
  computed,
  defineAsyncComponent,
  defineComponent,
  h,
  inject,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onUnmounted,
  onUpdated,
  provide,
  reactive,
  readonly,
  ref,
  shallowReactive,
  shallowRef,
  toRaw,
  toRef,
  toRefs,
  unref,
  watch,
  watchEffect,
  watchPostEffect,
  // Block / VNode creation (template compiler runtime helpers)
  openBlock,
  createBlock,
  createElementBlock,
  createVNode,
  createElementVNode,
  createTextVNode,
  createCommentVNode,
  createStaticVNode,
  // Interpolation
  toDisplayString,
  // Normalization helpers
  normalizeClass,
  normalizeStyle,
  normalizeProps,
  mergeProps,
  // List / conditional
  renderList,
  Fragment,
  KeepAlive,
  Teleport,
  Suspense,
  // Directives
  withDirectives,
  // Component resolution
  resolveComponent,
  resolveDynamicComponent,
  resolveDirective,
  // Slots
  withCtx,
  renderSlot,
  useSlots,
  defineSlots,
  // Script setup macros (runtime stubs used in SFCs)
  defineProps,
  defineEmits,
  defineExpose,
  defineOptions,
  defineModel,
  useAttrs,
} from '@vue/runtime-core';

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

export { MainThreadRef, useMainThreadRef, runOnMainThread };

/**
 * Reset all module-level state between tests.
 * Must be called before each test to ensure isolation.
 */
export function resetForTesting(): void {
  resetRegistry();
  resetNodeOpsState();
  resetFlushState();
  resetMainThreadRefState();
  takeOps(); // drain any leftover ops
  ShadowElement.nextId = 2;
}
