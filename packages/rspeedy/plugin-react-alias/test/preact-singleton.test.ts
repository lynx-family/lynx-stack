// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import { afterAll, describe, expect, test } from '@rstest/core'

import { LAYERS } from '@lynx-js/react-webpack-plugin'

import { pluginReactAlias } from '../src/index.js'

const fixtureRoot = fileURLToPath(
  new URL('./fixtures/preact-singleton', import.meta.url),
)
const tempDirs: string[] = []

afterAll(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  )
})

async function copyDirectory(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true })
  const entries = await readdir(source, { withFileTypes: true })
  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(source, entry.name)
      const targetPath = path.join(target, entry.name)
      if (entry.isDirectory()) {
        await copyDirectory(sourcePath, targetPath)
      } else {
        await copyFile(sourcePath, targetPath)
      }
    }),
  )
}

async function installFixturePackage(
  packageName: string,
  source: string,
  nodeModules: string,
): Promise<string> {
  const target = path.join(nodeModules, ...packageName.split('/'))
  await mkdir(path.dirname(target), { recursive: true })
  await copyDirectory(source, target)
  return target
}

async function readJavaScript(root: string): Promise<string> {
  const entries = await readdir(root, { withFileTypes: true })
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name)
      if (entry.isDirectory()) {
        return await readJavaScript(entryPath)
      }
      return entry.name.endsWith('.js') ? await readFile(entryPath, 'utf8') : ''
    }),
  )
  return contents.join('\n')
}

describe('React - Preact singleton', () => {
  test('Signals resolves Preact from the selected React package', async () => {
    const projectRoot = await mkdtemp(
      path.join(tmpdir(), 'react-alias-preact-singleton-'),
    )
    tempDirs.push(projectRoot)

    const appDir = path.join(projectRoot, 'app')
    await copyDirectory(path.join(fixtureRoot, 'app'), appDir)

    const nodeModules = path.join(projectRoot, 'node_modules')
    const packages = path.join(fixtureRoot, 'packages')
    const reactDir = await installFixturePackage(
      '@lynx-js/react',
      path.join(packages, 'react'),
      nodeModules,
    )
    const signalsDir = await installFixturePackage(
      '@lynx-js/react-signals',
      path.join(packages, 'react-signals'),
      nodeModules,
    )

    await installFixturePackage(
      'preact',
      path.join(packages, 'react-preact'),
      path.join(reactDir, 'node_modules'),
    )
    await installFixturePackage(
      'preact',
      path.join(packages, 'signals-preact'),
      path.join(signalsDir, 'node_modules'),
    )

    const outputRoot = path.join(projectRoot, 'dist')
    const rsbuild = await createRsbuild({
      cwd: projectRoot,
      rsbuildConfig: {
        source: {
          entry: {
            main: {
              import: path.join(appDir, 'index.js'),
              layer: LAYERS.BACKGROUND,
            },
          },
        },
        output: {
          distPath: { root: outputRoot },
          filenameHash: false,
          minify: false,
        },
        performance: {
          chunkSplit: { strategy: 'all-in-one' },
        },
        plugins: [
          pluginReactAlias({ LAYERS, rootPath: projectRoot }),
        ],
      },
    })

    const result = await rsbuild.build()
    await result.close()

    const bundle = await readJavaScript(outputRoot)
    expect(bundle).toContain('react-selected-preact')
    expect(bundle).toContain('react-selected-preact-hooks')
    expect(bundle).not.toContain('react-signals-private-preact')
    expect(bundle).not.toContain('react-signals-private-preact-hooks')
  }, 30_000)
})
