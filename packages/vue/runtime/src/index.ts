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
  type App,
  type Component,
  type ComponentPublicInstance,
} from '@vue/runtime-core'

import { registerMount } from './app-registry.js'
import { nodeOps } from './node-ops.js'
import { createPageRoot, type ShadowElement } from './shadow-element.js'

export type { App, Component, ComponentPublicInstance, ShadowElement }

const { createApp: _createApp, render } = createRenderer<
  ShadowElement,
  ShadowElement
>(nodeOps)

export { render }

// ---------------------------------------------------------------------------
// createApp – defers mount until Lynx renderPage fires
// ---------------------------------------------------------------------------

export interface VueLynxApp {
  mount(): void
  use(plugin: unknown, ...options: unknown[]): VueLynxApp
  provide(key: unknown, value: unknown): VueLynxApp
  config: App['config']
  [key: string]: unknown
}

export function createApp(
  rootComponent: Component,
  rootProps?: Record<string, unknown>,
): VueLynxApp {
  const internalApp = _createApp(rootComponent, rootProps)

  const app: VueLynxApp = {
    get config() { return internalApp.config },

    use(plugin: unknown, ...options: unknown[]): VueLynxApp {
      internalApp.use(plugin as Parameters<App['use']>[0], ...options)
      return app
    },

    provide(key: unknown, value: unknown): VueLynxApp {
      internalApp.provide(
        key as Parameters<App['provide']>[0],
        value,
      )
      return app
    },

    mount(): void {
      registerMount(() => {
        const root = createPageRoot()
        internalApp.mount(root)
      })
    },
  }

  return app
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
} from '@vue/runtime-core'
