// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'
import { parse } from 'yaml'

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
)

interface PackageJSON {
  name?: string
  private?: boolean
  devDependencies?: Record<string, string>
}

async function readPackageJSON(dir: string): Promise<PackageJSON | undefined> {
  try {
    return JSON.parse(
      await readFile(path.join(dir, 'package.json'), 'utf-8'),
    ) as PackageJSON
  } catch {
    return undefined
  }
}

async function expandPattern(pattern: string): Promise<string[]> {
  const parent = pattern.endsWith('/*') ? pattern.slice(0, -2) : pattern
  if (/[*?[{]/.test(parent)) {
    throw new Error(`Unsupported workspace pattern: ${pattern}`)
  }
  if (parent === pattern) {
    return [pattern]
  }
  const entries = await readdir(path.join(workspaceRoot, parent), {
    withFileTypes: true,
  })
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => `${parent}/${entry.name}`)
}

async function findPublishedPackages(): Promise<string[]> {
  const { packages = [] } = parse(
    await readFile(path.join(workspaceRoot, 'pnpm-workspace.yaml'), 'utf-8'),
  ) as { packages?: string[] }
  const excluded = new Set(
    packages.filter(pattern => pattern.startsWith('!')).map(pattern =>
      pattern.slice(1)
    ),
  )
  const names = new Set<string>()

  for (const pattern of packages.filter(pattern => !pattern.startsWith('!'))) {
    for (const dir of await expandPattern(pattern)) {
      if (excluded.has(dir)) {
        continue
      }
      const json = await readPackageJSON(path.join(workspaceRoot, dir))
      if (json?.name?.startsWith('@lynx-js/') && json.private !== true) {
        names.add(json.name)
      }
    }
  }

  return [...names].sort()
}

describe('Coverage', () => {
  test('every published Lynx package can be upgraded', async () => {
    const self = await readPackageJSON(
      path.join(workspaceRoot, 'packages/rspeedy/upgrade-rspeedy'),
    )
    const upgradable = new Set(Object.keys(self?.devDependencies ?? {}))

    const published = await findPublishedPackages()
    const missing = published.filter(name => !upgradable.has(name))

    expect(missing).toStrictEqual([])
  })
})
