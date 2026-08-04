// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

rstest
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'production')

// biome-ignore lint/suspicious/noEmptyBlockStatements: the stubs are no-ops
const noop = (): void => {}

interface StubElement {
  tag: string
  id: number
  children: StubElement[]
  attributes: Record<string, unknown>
}

function createMainThreadEnv() {
  let nextId = 1
  const create = (tag: string): StubElement => ({
    tag,
    id: nextId++,
    children: [],
    attributes: {},
  })
  let page: StubElement | undefined
  const lifecycleEvents: unknown[][] = []

  const env: Record<string, unknown> = {
    console,
    setTimeout,
    clearTimeout,
    globDynamicComponentEntry: '__Card__',
    lynx: {
      __initData: {},
      getNativeApp: () => ({ callLepusMethod: noop }),
      reportError: (error: unknown) => {
        throw error
      },
      performance: {
        profileStart: noop,
        profileEnd: noop,
        profileMark: noop,
      },
      queueMicrotask: (fn: () => void) => void Promise.resolve().then(fn),
    },
    __CreatePage: () => (page = create('page')),
    __CreateView: () => create('view'),
    __CreateText: () => create('text'),
    __CreateImage: () => create('image'),
    __CreateRawText: (text: unknown) => {
      const element = create('raw-text')
      element.attributes['text'] = text
      return element
    },
    __CreateElement: (tag: string) => create(tag),
    __CreateWrapperElement: () => create('wrapper'),
    __CreateScrollView: () => create('scroll-view'),
    __CreateList: () => create('list'),
    __AppendElement: (parent: StubElement, child: StubElement) =>
      parent.children.push(child),
    __InsertElementBefore: (
      parent: StubElement,
      child: StubElement,
      before?: StubElement,
    ) => {
      const index = before ? parent.children.indexOf(before) : -1
      if (index === -1) {
        parent.children.push(child)
      } else {
        parent.children.splice(index, 0, child)
      }
    },
    __RemoveElement: (parent: StubElement, child: StubElement) => {
      parent.children = parent.children.filter(element => element !== child)
    },
    __ReplaceElement: (newElement: StubElement, oldElement: StubElement) => {
      const walk = (node: StubElement | undefined): boolean => {
        if (!node) return false
        const index = node.children.indexOf(oldElement)
        if (index !== -1) {
          node.children[index] = newElement
          return true
        }
        return node.children.some((child) => walk(child))
      }
      walk(page)
    },
    __SetAttribute: (
      element: StubElement,
      key: string,
      value: unknown,
    ) => (element.attributes[key] = value),
    __SetClasses: (
      element: StubElement,
      value: unknown,
    ) => (element.attributes['class'] = value),
    __SetInlineStyles: (
      element: StubElement,
      value: unknown,
    ) => (element.attributes['style'] = value),
    __SetID: (
      element: StubElement,
      value: unknown,
    ) => (element.attributes['id'] = value),
    __AddDataset: (
      element: StubElement,
      key: string,
      value: unknown,
    ) => (element.attributes[`data-${key}`] = value),
    __GetTag: (element: StubElement) => element.tag,
    __SetCSSId: noop,
    __AddEvent: noop,
    __SetEvents: noop,
    __FlushElementTree: noop,
    __GetPageElement: () => page,
    __GetElementUniqueID: (element: StubElement) => element.id,
    __GetTemplateParts: () => ({}),
    __ElementIsEqual: (a: StubElement, b: StubElement) => a === b,
    __OnLifecycleEvent: (event: unknown[]) => void lifecycleEvents.push(event),
    _ReportError: (error: unknown) => {
      throw error
    },
  }
  env['globalThis'] = env

  return {
    env,
    getPage: () => page,
    lifecycleEvents,
  }
}

interface SerializedInstance {
  id: number
  type: string
  children?: SerializedInstance[] | undefined
}

async function buildFixture(entry: string, tmp: string) {
  const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

  let mainThread = ''

  const rsbuild = await createRspeedy({
    rspeedyConfig: {
      mode: 'production',
      source: {
        entry: {
          main: fileURLToPath(
            new URL(`./fixtures/root-background/${entry}`, import.meta.url),
          ),
        },
      },
      output: { distPath: { root: tmp } },
      plugins: [
        // The declarative trigger: no `enableMTSRendering` option at all.
        pluginReactLynx(),
        {
          name: 'ignore-css-loader-workaround',
          pre: ['lynx:react'],
          setup(api) {
            api.modifyBundlerChain((chain, { CHAIN_ID }) => {
              const rule = chain.module
                .rules.get('css:react:main-thread')
                .uses.get(CHAIN_ID.USE.IGNORE_CSS)
              rule.loader(rule.get('loader') as string + '.ts')
            })
          },
        } as RsbuildPlugin,
      ],
      tools: {
        rspack: {
          plugins: [
            {
              name: 'collect-main-thread',
              apply(compiler) {
                compiler.hooks.compilation.tap(
                  'collect-main-thread',
                  (compilation) => {
                    compilation.hooks.processAssets.tap(
                      'collect-main-thread',
                      (assets) => {
                        for (const name in assets) {
                          if (name.endsWith('main-thread.js')) {
                            mainThread = assets[name]!.source().toString()
                          }
                        }
                      },
                    )
                  },
                )
              },
            } as Rspack.RspackPluginInstance,
          ],
        },
      },
    },
  })

  await rsbuild.build()

  return mainThread
}

describe('root <Background fallback> with a user component', () => {
  test('the first frame renders the fallback component, and hydration replaces it', async () => {
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-root-background-runtime-'),
    )

    try {
      const mainThread = await buildFixture('component-fallback.tsx', tmp)

      // The fallback is real main-thread code: the *logic* of `Skeleton`'s
      // body — a helper it calls, not an element definition — was compiled
      // into this bundle.
      expect(mainThread).toContain('-from-fallback-logic')
      // The deferred app's logic was not: only its element definitions travel
      // here, through the assembly channel, for hydration to build from.
      expect(mainThread).not.toContain('root-background-business-marker')
      expect(mainThread).toContain('__initMTSDefines')

      const { env, getPage, lifecycleEvents } = createMainThreadEnv()
      vm.createContext(env)
      vm.runInContext(mainThread, env, { filename: 'main-thread.js' })

      const renderPage = env['renderPage'] as (data: unknown) => void
      expect(renderPage).toBeTypeOf('function')

      renderPage({})

      // The pre-hydration first frame is what the component rendered: all
      // three rows, each label computed by its body at runtime — not a static
      // blob, and not an empty page.
      const firstFrame = JSON.stringify(getPage())
      for (const row of [0, 1, 2]) {
        expect(firstFrame).toContain(`skeleton-row-${row}-from-fallback-logic`)
      }

      // The first-screen sync hands that tree to the background, whose
      // ordinary hydration diff replaces it with the real content.
      const firstScreen = lifecycleEvents.find((event) =>
        Array.isArray(event) && event[0] === 'rLynxFirstScreen'
      ) as [string, { root: string }] | undefined
      expect(firstScreen).toBeDefined()

      const serializedRoot = JSON.parse(
        firstScreen![1].root,
      ) as SerializedInstance
      expect(serializedRoot.children?.length).toBeGreaterThan(0)

      const definitions = [
        ...new Set(mainThread.match(/__snapshot_[0-9a-f]+_[0-9a-f]+_\d+/g)),
      ]
      const contentId = definitions.at(-1)!
      const fallbackRoot = serializedRoot.children![0]!

      const rLynxChange = env['rLynxChange'] as (args: {
        data: string
        patchOptions: { reloadVersion: number }
      }) => void
      rLynxChange({
        data: JSON.stringify({
          patchList: [{
            id: 1,
            snapshotPatch: [
              /* CreateElement(type, id) */ 0,
              contentId,
              100,
              /* InsertBefore(parent, child, before, slotIndex) */ 1,
              fallbackRoot.id,
              100,
              undefined,
              0,
              /* RemoveChild(parent, child) */ 2,
              fallbackRoot.id,
              fallbackRoot.children![0]!.id,
            ],
          }],
        }),
        patchOptions: { reloadVersion: 0 },
      })

      expect(JSON.stringify(getPage())).not.toContain(
        'skeleton-row-0-from-fallback-logic',
      )
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })
})
