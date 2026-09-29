// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { afterAll, expect, test } from '@rstest/core'

import {
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
} from '@lynx-js/element-template-runtime'
import { pluginLynx } from '@lynx-js/rsbuild-plugin'
import { createRspeedy } from '@lynx-js/rspeedy'
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'
import type { TemplateHooks } from '@lynx-js/template-webpack-plugin'

import { pluginSolidLynx } from '../src/index.js'

const tempDirs: string[] = []

afterAll(async () => {
  await Promise.all(tempDirs.map(async dir => {
    await rm(dir, { force: true, recursive: true })
  }))
})

test('builds one Solid source into both Lynx threads', async () => {
  const outputRoot = await mkdtemp(
    path.join(tmpdir(), 'rspeedy-solid-test-'),
  )
  tempDirs.push(outputRoot)
  const beforeEncodeCalls: (
    Parameters<Parameters<TemplateHooks['beforeEncode']['tap']>[1]>[0]
  )[] = []
  const observeTemplate: RsbuildPlugin = {
    name: 'test:observe-solid-template',
    setup(api) {
      api.modifyBundlerChain(chain => {
        const plugin: Rspack.RspackPluginInstance = {
          apply(compiler) {
            compiler.hooks.thisCompilation.tap(
              'test:observe-solid-template',
              compilation => {
                const hooks = LynxTemplatePlugin
                  .getLynxTemplatePluginHooks(compilation)
                hooks.beforeEncode.tap(
                  'test:observe-solid-template',
                  args => {
                    beforeEncodeCalls.push(args)
                    return args
                  },
                )
              },
            )
          },
        }
        chain.plugin('test:observe-solid-template').use(plugin)
      })
    },
  }
  const entry = fileURLToPath(
    new URL('./fixtures/basic/index.tsx', import.meta.url),
  )
  const rspeedy = await createRspeedy({
    cwd: path.dirname(entry),
    rspeedyConfig: {
      environments: {
        lynx: {},
        web: {},
      },
      mode: 'development',
      output: {
        distPath: { root: outputRoot },
      },
      plugins: [
        pluginLynx(),
        pluginSolidLynx(),
        observeTemplate,
      ],
      source: {
        entry: { main: entry },
      },
    },
  })

  await rspeedy.build()

  expect(existsSync(path.join(outputRoot, 'main.lynx.bundle'))).toBe(true)
  expect(existsSync(path.join(outputRoot, 'main.web.bundle'))).toBe(true)
  expect(existsSync(
    path.join(outputRoot, '.lynx/main/background.js'),
  )).toBe(true)
  expect(beforeEncodeCalls).toHaveLength(2)

  for (const args of beforeEncodeCalls) {
    expect(args.encodeData.compilerOptions['enableElementTemplate']).toBe(
      true,
    )
    expect(
      args.encodeData.sourceContent.config['enableElementTemplate'],
    ).toBe(true)
    expect(
      args.encodeData.sourceContent.config['enableUnifyFixedBehavior'],
    ).toBe(true)
    expect(args.encodeData.lepusCode.root?.name).toBe(
      '.lynx/main/main-thread.js',
    )
    expect(
      Object.keys(args.encodeData.manifest).some(
        asset => asset.endsWith('.lynx/main/background.js'),
      ),
    ).toBe(true)
    expect(
      args.encodeData.elementTemplate?.[BUILTIN_RAW_TEXT_TEMPLATE_KEY],
    ).toEqual({
      kind: 'element',
      type: 'raw-text',
      attributesArray: [{
        kind: 'slot',
        key: 'text',
        attrSlotIndex: 0,
      }],
      children: [],
    })
    const compiledTemplates = Object.entries(
      args.encodeData.elementTemplate ?? {},
    ).filter(([key]) => key.startsWith('_solid_et_'))
    expect(compiledTemplates).toHaveLength(2)
    expect(
      compiledTemplates.some(([, template]) =>
        JSON.stringify(template).includes('"value":"counter"')
      ),
    ).toBe(true)
    expect(
      compiledTemplates.every(([, template]) =>
        JSON.stringify(template).includes('"type":"text"')
      ),
    ).toBe(true)
    expect(args.encodeData.elementTemplate?.['view']).toBeUndefined()
  }

  const background = await readFile(
    path.join(outputRoot, '.lynx/main/background.js'),
    'utf8',
  )
  const mainThread = await readFile(
    path.join(outputRoot, '.lynx/main/main-thread.js'),
    'utf8',
  )
  expect(background).toContain('Lynx.Solid.ready')
  expect(background).toContain('Lynx.ElementTemplate.commit')
  expect(background).toContain('bindtap')
  expect(background).toContain('_solid_et_')
  expect(background).toContain('setTemplateAttribute')
  expect(background).toContain('setTemplateText')
  expect(background).not.toContain('.firstChild')
  expect(background).not.toContain('.nextSibling')
  expect(background).not.toContain('textContentAttributeSlotIndex')
  expect(background).not.toContain(
    '<svg><view class=counter><text></svg>',
  )
  expect(background).toContain('createRoot)(\'background\'')
  expect(background).toContain('renderSolidLynx')
  expect(background).not.toContain('requireModuleAsync')
  expect(mainThread).toContain('createRoot)(\'main-thread\'')
  expect(mainThread).toContain('renderSolidLynxInitial')
  expect(mainThread).toContain('createSignal')
  expect(mainThread).toContain('createComponent')
  expect(mainThread).toContain('For')
  expect(mainThread).toContain('Show')
  expect(mainThread).toContain('Cannot update signal in main thread!')
  expect(mainThread).not.toContain('function createSignal(value, options)')
  expect(mainThread).not.toContain('createComputation')
  expect(mainThread).not.toContain('createRenderer(')
  expect(mainThread).not.toContain('observerSlots')
  expect(mainThread).not.toContain('writeSignal')
  expect(mainThread).toContain('setTemplateAttribute')
  expect(mainThread).toContain('setTemplateText')
  expect(mainThread).toContain('_solid_et_')
  expect(mainThread).not.toContain('requireModuleAsync')
  expect(mainThread).toContain('__RenderPage')
  expect(mainThread).toContain('__UpdatePage')
  expect(mainThread).toContain('__DestroyLifetime')
  expect(mainThread).not.toContain('__lynxRuntimeProcessData')
  expect(mainThread).not.toContain('__lynxRuntimeRenderPage')
  expect(mainThread).not.toContain('__lynxRuntimeUpdatePage')
  expect(mainThread).not.toContain('function processData(data)')
  expect(mainThread).not.toContain('function renderPage(data, options)')
  expect(mainThread).not.toContain('function updatePage(data, options)')
})
