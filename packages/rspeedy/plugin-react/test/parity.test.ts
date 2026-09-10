// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

import { afterAll, describe, expect, test } from '@rstest/core'

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const cwd = import.meta.dirname
const roots: string[] = []

// Each build runs in its own process: a second build in the same process
// produces a different chunk content hash, so builds sharing a process cannot
// be compared.
function build(tool: 'rspeedy' | 'rsbuild', mode: string): Buffer {
  const root = `dist-parity-${mode}-${tool}`
  roots.push(root)
  execFileSync(
    process.execPath,
    [path.join(cwd, 'parity', 'build.mjs'), tool, mode, root],
    { cwd, stdio: 'ignore' },
  )
  return readFileSync(path.join(cwd, root, 'main.lynx.bundle'))
}

// Identifiers minted per build rather than derived from the source: the
// development timestamp and hot-update hashes, and the debug metadata release,
// which is keyed on `chunk.hash`.
const stripPerBuildIds = (bundle: Buffer) =>
  bundle
    .toString('latin1')
    .replaceAll(/\/\/ \d{10,}/g, '// <timestamp>')
    .replaceAll(/__webpack_require__\.h = \(\) => \("[0-9a-f]+"\)/g, '<hmr>')
    .replaceAll(/debugmetadata:[0-9a-f]+/g, 'debugmetadata:<release>')
    .replaceAll(/\.hot-update\.js [0-9a-f]+/g, '.hot-update.js <hash>')

afterAll(() => {
  for (const root of roots) {
    rmSync(path.join(cwd, root), { recursive: true, force: true })
  }
})

describe('Rspeedy and Rsbuild parity', () => {
  test('production bundles match apart from per-build identifiers', () => {
    expect(stripPerBuildIds(build('rsbuild', 'production'))).toBe(
      stripPerBuildIds(build('rspeedy', 'production')),
    )
  })

  test('development bundles match apart from per-build identifiers', () => {
    expect(stripPerBuildIds(build('rsbuild', 'development'))).toBe(
      stripPerBuildIds(build('rspeedy', 'development')),
    )
  })
})
