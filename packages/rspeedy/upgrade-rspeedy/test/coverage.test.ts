// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
)

async function readPackageJSON(
  file: string,
): Promise<{ name?: string, private?: boolean } | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf-8')) as {
      name?: string
      private?: boolean
    }
  } catch {
    return undefined
  }
}

async function findPublishedPackages(): Promise<string[]> {
  const groups = await readdir(path.join(workspaceRoot, 'packages'), {
    withFileTypes: true,
  })
  const names: string[] = []

  for (const group of groups.filter(entry => entry.isDirectory())) {
    const groupPath = path.join(workspaceRoot, 'packages', group.name)
    const packages = await readdir(groupPath, { withFileTypes: true })

    for (const pkg of packages.filter(entry => entry.isDirectory())) {
      const json = await readPackageJSON(
        path.join(groupPath, pkg.name, 'package.json'),
      )
      if (json?.name?.startsWith('@lynx-js/') && json.private !== true) {
        names.push(json.name)
      }
    }
  }

  return names.sort()
}

describe('Coverage', () => {
  test('every published Lynx package can be upgraded', async () => {
    const self = await readPackageJSON(
      path.join(workspaceRoot, 'packages/rspeedy/upgrade-rspeedy/package.json'),
    ) as { devDependencies?: Record<string, string> }
    const upgradable = new Set(Object.keys(self.devDependencies ?? {}))

    const published = await findPublishedPackages()
    const missing = published.filter(name => !upgradable.has(name))

    expect(missing).toStrictEqual([])
  })
})
