// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { rspack } from '@rspack/core'
import { afterEach, describe, expect, test } from '@rstest/core'

import { createLazyResolver } from '../src/index.js'

interface PnpPackageData {
  packageLocation: string
  packageDependencies: [string, string][]
  linkType: 'SOFT' | 'HARD'
}

// The Yarn PnP manifest is a `.pnp.cjs` script with the state inlined as a
// JSON string literal, which is what the resolver actually parses.
function pnpManifest(
  packageRegistryData: [string | null, [string | null, PnpPackageData][]][],
): string {
  const state = {
    __info: [],
    dependencyTreeRoots: [{ name: 'parent-app', reference: 'workspace:.' }],
    enableTopLevelFallback: true,
    ignorePatternData: null,
    fallbackExclusionList: [],
    fallbackPool: [],
    packageRegistryData,
  }
  return `const RAW_RUNTIME_STATE =\n'${JSON.stringify(state)}'\n`
}

async function writePackage(dir: string, name: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name, version: '1.0.0', main: './index.js' }),
  )
  await fs.writeFile(path.join(dir, 'index.js'), 'export {}\n')
}

describe('createLazyResolver - Yarn PnP', () => {
  const tmpDirs: string[] = []

  async function makeTmpDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'react-alias-pnp-'))
    tmpDirs.push(dir)
    // `os.tmpdir()` may be a symlink on macOS (`/tmp` -> `/private/tmp`).
    return await fs.realpath(dir)
  }

  afterEach(async () => {
    delete (process.versions as { pnp?: string }).pnp
    await Promise.all(
      tmpDirs.splice(0).map(dir =>
        fs.rm(dir, { recursive: true, force: true })
      ),
    )
  })

  test('ignores a stray .pnp.cjs in an ancestor directory when not running under PnP', async () => {
    // https://github.com/lynx-family/lynx-stack/issues/2539
    // A leftover PnP manifest above an npm project (e.g. from a previous
    // Yarn Berry install in `$HOME`) must not hijack module resolution.
    const root = await makeTmpDir()
    const project = path.join(root, 'project')

    // The manifest only knows about the workspace root, not `fake-pkg`.
    await fs.writeFile(
      path.join(root, '.pnp.cjs'),
      pnpManifest([
        [null, [[null, {
          packageLocation: './',
          packageDependencies: [],
          linkType: 'SOFT',
        }]]],
        ['parent-app', [['workspace:.', {
          packageLocation: './',
          packageDependencies: [['parent-app', 'workspace:.']],
          linkType: 'SOFT',
        }]]],
      ]),
    )
    await writePackage(
      path.join(project, 'node_modules', 'fake-pkg'),
      'fake-pkg',
    )

    const resolve = createLazyResolver(rspack, project, ['import'])

    await expect(resolve('fake-pkg')).resolves.toBe(
      path.join(project, 'node_modules', 'fake-pkg', 'index.js'),
    )
  })

  test('resolves through the PnP manifest when running under PnP', async () => {
    const root = await makeTmpDir()
    const project = path.join(root, 'project')

    // The manifest maps `fake-pkg` to a PnP-managed location.
    await fs.writeFile(
      path.join(root, '.pnp.cjs'),
      pnpManifest([
        [null, [[null, {
          packageLocation: './',
          packageDependencies: [],
          linkType: 'SOFT',
        }]]],
        ['parent-app', [['workspace:.', {
          packageLocation: './',
          packageDependencies: [
            ['parent-app', 'workspace:.'],
            ['fake-pkg', 'npm:1.0.0'],
          ],
          linkType: 'SOFT',
        }]]],
        ['fake-pkg', [['npm:1.0.0', {
          packageLocation: './pnp-pkgs/fake-pkg/',
          packageDependencies: [['fake-pkg', 'npm:1.0.0']],
          linkType: 'HARD',
        }]]],
      ]),
    )
    await writePackage(path.join(root, 'pnp-pkgs', 'fake-pkg'), 'fake-pkg')
    // Also present in node_modules to prove the PnP manifest wins.
    await writePackage(
      path.join(project, 'node_modules', 'fake-pkg'),
      'fake-pkg',
    )

    Object.defineProperty(process.versions, 'pnp', {
      value: '3',
      configurable: true,
      enumerable: true,
    })

    const resolve = createLazyResolver(rspack, project, ['import'])

    await expect(resolve('fake-pkg')).resolves.toBe(
      path.join(root, 'pnp-pkgs', 'fake-pkg', 'index.js'),
    )
  })
})
