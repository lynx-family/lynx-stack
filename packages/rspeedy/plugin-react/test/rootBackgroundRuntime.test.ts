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
    __InsertElementBefore: (parent: StubElement, child: StubElement) =>
      parent.children.push(child),
    __RemoveElement: (parent: StubElement, child: StubElement) => {
      parent.children = parent.children.filter(element => element !== child)
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

async function buildRootBackgroundFixture(entry: string, tmp: string) {
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

  return { getMainThread: () => mainThread }
}

describe('root <Background fallback> runtime (enableMTSRendering: "auto")', () => {
  test('the first frame renders the static fallback, and hydration replaces it', async () => {
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-root-background-runtime-'),
    )

    try {
      const { getMainThread } = await buildRootBackgroundFixture(
        'index.tsx',
        tmp,
      )
      const mainThread = getMainThread()

      // The bundle is assembled from the background-collected definitions and
      // names the root fallback snapshot.
      expect(mainThread).toContain('__initMTSDefines')
      const fallbackId = /__setRootMTSFallback\("(__snapshot_[^"]+)"\)/
        .exec(mainThread)?.[1]
      expect(fallbackId).toBeTypeOf('string')

      const definitions = [
        ...new Set(mainThread.match(/__snapshot_[0-9a-f]+_[0-9a-f]+_\d+/g)),
      ]
      expect(definitions.length).toBeGreaterThan(1)

      const { env, getPage, lifecycleEvents } = createMainThreadEnv()
      vm.createContext(env)
      vm.runInContext(mainThread, env, { filename: 'main-thread.js' })

      const renderPage = env['renderPage'] as (data: unknown) => void
      expect(renderPage).toBeTypeOf('function')

      renderPage({})

      // The pre-hydration first frame is the skeleton, not an empty page.
      const page = getPage()
      expect(page?.children).toHaveLength(1)
      expect(JSON.stringify(page)).toContain('root-background-skeleton-marker')

      // The first-screen sync carries the fallback instance to the background,
      // where the ordinary hydration diff replaces it: simulate the resulting
      // patch (remove the unmatched fallback, insert the real content).
      const firstScreen = lifecycleEvents.find((event) =>
        Array.isArray(event) && event[0] === 'rLynxFirstScreen'
      ) as [string, { root: string }] | undefined
      expect(firstScreen).toBeDefined()

      const serializedRoot = JSON.parse(
        firstScreen![1].root,
      ) as SerializedInstance
      expect(serializedRoot.children).toHaveLength(1)
      const fallbackInstance = serializedRoot.children![0]!
      expect(fallbackInstance.type).toBe(fallbackId)

      const contentId = definitions.find((definition) =>
        definition !== fallbackId
      )!
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
              serializedRoot.id,
              100,
              undefined,
              0,
              /* RemoveChild(parent, child) */ 2,
              serializedRoot.id,
              fallbackInstance.id,
            ],
          }],
        }),
        patchOptions: { reloadVersion: 0 },
      })

      const hydrated = getPage()
      expect(hydrated?.children).toHaveLength(1)
      expect(JSON.stringify(hydrated)).not.toContain(
        'root-background-skeleton-marker',
      )
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })
})
