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
} from '@vue/runtime-core';

import { nodeOps } from './node-ops.js';
import { createPageRoot } from './shadow-element.js';
import type { ShadowElement } from './shadow-element.js';

export type { App, Component, ComponentPublicInstance, ShadowElement };

const _renderer = createRenderer<ShadowElement, ShadowElement>(nodeOps);
const _createApp = _renderer.createApp;

// ---------------------------------------------------------------------------
// createApp – mounts immediately when called (main-thread renderPage runs
// before the background bundle is initialised by Lynx, so page root id=1
// is always ready by the time app.mount() executes)
// ---------------------------------------------------------------------------

export interface VueLynxApp {
  mount(): void;
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
  };

  return app;
}

// ---------------------------------------------------------------------------
// Re-export commonly used Vue APIs
// ---------------------------------------------------------------------------

export {
  computed,
  defineAsyncComponent,
  defineComponent,
  Fragment,
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
} from '@vue/runtime-core';
