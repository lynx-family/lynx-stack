// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import {
  afterAll,
  afterEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

const tempDirs: string[] = []

const passiveLoopEntry = fileURLToPath(
  new URL('./fixtures/debug-passive-loop.tsx', import.meta.url),
)

afterEach(() => {
  rstest.unstubAllEnvs()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(async (dir) => {
      await rm(dir, { recursive: true, force: true })
    }),
  )
})

async function buildBundle(options: {
  mode: 'development' | 'production'
  elementTemplate: boolean
}) {
  rstest
    .stubEnv('USE_RSPACK', 'true')
    .stubEnv('NODE_ENV', options.mode)

  const { pluginReactLynx } = await import('../src/index.js')
  const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-react-debug-'))
  tempDirs.push(tmp)

  const rsbuild = await createRspeedy({
    rspeedyConfig: {
      dev: {
        hmr: false,
        liveReload: false,
      },
      source: {
        entry: {
          main: passiveLoopEntry,
        },
      },
      output: {
        distPath: { root: tmp },
        filenameHash: false,
      },
      tools: {
        rspack: {
          context: dirname(fileURLToPath(import.meta.url)),
          resolve: {
            extensionAlias: {
              '.js': ['.ts', '.js'],
              '.jsx': ['.tsx', '.jsx'],
            },
          },
        },
      },
      plugins: [
        pluginReactLynx({
          experimental_useElementTemplate: options.elementTemplate,
          ...(options.mode === 'production'
            ? { optimizeBundleSize: true }
            : {}),
        }),
        pluginStubRspeedyAPI(),
      ],
    },
  })

  const result = await rsbuild.build()
  await result.close()

  const mainThreadCode = await readFile(
    path.join(tmp, '.lynx/main/main-thread.js'),
    'utf8',
  )
  const backgroundCode = await readFile(
    path.join(tmp, '.lynx/main/background.js'),
    'utf8',
  )
  return { mainThreadCode, backgroundCode }
}

async function executeBackgroundBundle(backgroundCode: string) {
  const errors: string[] = []
  const definitions = new Map<string, (...args: unknown[]) => unknown>()

  const app: Record<string, unknown> = {
    _params: {
      initData: {},
    },
  }
  const coreContext = {
    addEventListener: rstest.fn(),
    removeEventListener: rstest.fn(),
    dispatchEvent: rstest.fn(),
  }
  const nativeApp = {
    callLepusMethod: rstest.fn(),
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
  }
  const eventEmitter = {
    addListener: rstest.fn(),
    removeListener: rstest.fn(),
    emit: rstest.fn(),
    trigger: rstest.fn(),
  }

  const sandboxConsole = {
    ...console,
    log: rstest.fn(),
    info: rstest.fn(),
    warn: rstest.fn(),
    error(...args: unknown[]) {
      errors.push(args.map(String).join(' '))
    },
  }

  const lynx = {
    __initData: {},
    __globalProps: {},
    targetSdkVersion: '3.2',
    Promise,
    queueMicrotask,
    getApp: () => app,
    getCoreContext: () => coreContext,
    getNativeApp: () => nativeApp,
    getJSModule: () => eventEmitter,
    reportError(err: unknown) {
      throw err
    },
    performance: {
      isProfileRecording: () => false,
      profileStart: rstest.fn(),
      profileEnd: rstest.fn(),
      profileMark: rstest.fn(),
      profileFlowId: () => 0,
      createObserver: () => ({ observe: rstest.fn(), disconnect: rstest.fn() }),
    },
  }

  const tt = {
    define: (name: string, factory: (...args: unknown[]) => unknown) => {
      definitions.set(name, factory)
    },
    require: (name: string): unknown => {
      const factory = definitions.get(name)
      if (!factory) {
        throw new Error(`Missing bundle definition: ${name}`)
      }
      const mod = { exports: {} }
      // Matches RuntimeWrapperWebpackPlugin defaultInjectVars order:
      // (require, module, exports, Card, setTimeout, setInterval, clearInterval,
      //  clearTimeout, NativeModules, tt, console, Component, ReactLynx,
      //  nativeAppId, Behavior, LynxJSBI, lynx, ...)
      factory(
        tt.require,
        mod,
        mod.exports,
        undefined,
        setTimeout,
        setInterval,
        clearInterval,
        clearTimeout,
        {},
        tt,
        sandboxConsole,
        undefined,
        undefined,
        '0',
        undefined,
        undefined,
        lynx,
      )
      return mod.exports
    },
  }

  const context = vm.createContext({
    tt,
    lynx,
    console: sandboxConsole,
    queueMicrotask,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    SystemInfo: { lynxSdkVersion: '3.2' },
    __PASSIVE_LOOP_COUNT__: undefined,
  })
  ;(context as Record<string, unknown>)['globalThis'] = context

  vm.runInContext(backgroundCode, context)

  for (let i = 0; i < 300; i++) {
    await Promise.resolve()
  }

  return {
    errors,
    finalCount: (context as { __PASSIVE_LOOP_COUNT__?: number })
      .__PASSIVE_LOOP_COUNT__,
  }
}

describe('@lynx-js/react/debug passive update depth bundling', () => {
  test.each(
    [
      ['Snapshot', false],
      ['Element Template', true],
    ] as const,
  )(
    'enables passive update depth diagnostic in %s development builds',
    async (_label, elementTemplate) => {
      const { backgroundCode } = await buildBundle({
        mode: 'development',
        elementTemplate,
      })

      expect(backgroundCode).toContain('Maximum update depth exceeded')

      const { errors, finalCount } = await executeBackgroundBundle(
        backgroundCode,
      )
      expect(finalCount).toBe(100)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('Maximum update depth exceeded')
      expect(errors[0]).toMatch(/in Counter[\s\S]*in App/)
    },
  )

  test.each(
    [
      ['Snapshot', false],
      ['Element Template', true],
    ] as const,
  )(
    'strips @lynx-js/react/debug diagnostics from %s production builds',
    async (_label, elementTemplate) => {
      const { mainThreadCode, backgroundCode } = await buildBundle({
        mode: 'production',
        elementTemplate,
      })

      expect(mainThreadCode).not.toContain('Maximum update depth exceeded')
      expect(mainThreadCode).not.toContain('Too many re-renders')
      expect(backgroundCode).not.toContain('Maximum update depth exceeded')
      expect(backgroundCode).not.toContain('Too many re-renders')

      const { errors, finalCount } = await executeBackgroundBundle(
        backgroundCode,
      )
      expect(finalCount).toBe(100)
      expect(errors).toEqual([])
    },
  )
})
