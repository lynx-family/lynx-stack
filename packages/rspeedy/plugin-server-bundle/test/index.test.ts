// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable n/no-unsupported-features/node-builtins -- Tests run on the repository's Node.js 22+ toolchain. */

import { existsSync } from 'node:fs'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { createRsbuild } from '@rsbuild/core'
import type { RsbuildConfig } from '@rsbuild/core'
import { unzipSync } from 'fflate'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { createRspeedy } from '@lynx-js/rspeedy'

import { pluginServerBundle } from '../src/index.js'

const directories: string[] = []
afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(
    directories.splice(0).map(dir => rm(dir, { recursive: true, force: true })),
  )
})

async function fixture(): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), 'rsbuild-zip-'))
  directories.push(cwd)
  await mkdir(path.join(cwd, 'src'))
  await mkdir(path.join(cwd, 'public'))
  await writeFile(
    path.join(cwd, 'src/index.js'),
    'import image from \'./logo.png\'; console.log(image); import(\'./lazy.js\');',
  )
  await writeFile(
    path.join(cwd, 'src/lazy.js'),
    'export const message = "lazy chunk"',
  )
  await writeFile(
    path.join(cwd, 'src/logo.png'),
    Buffer.from([137, 80, 78, 71]),
  )
  await writeFile(path.join(cwd, 'public/extra.txt'), 'public asset')
  return cwd
}

function config(): RsbuildConfig {
  return {
    mode: 'production',
    source: { entry: { main: './src/index.js' } },
    output: {
      target: 'node',
      assetPrefix: 'https://cdn.example.com/',
      dataUriLimit: 0,
      minify: false,
      sourceMap: false,
    },
    server: { publicDir: { copyOnBuild: true }, port: 0, host: '127.0.0.1' },
    dev: { cliShortcuts: false, writeToDisk: true },
    plugins: [pluginServerBundle()],
  }
}

describe('pluginServerBundle', () => {
  test('packages a real ReactLynx bundle with external image resources', async () => {
    const cwd = await fixture()
    await writeFile(
      path.join(cwd, 'src/index.jsx'),
      `
      import { root } from '@lynx-js/react'
      import logo from './logo.png'
      root.render(<view><image src={logo} /><text>ZIP fixture</text></view>)
    `,
    )
    const rspeedy = await createRspeedy({
      // Resolve ReactLynx from the workspace without a temporary node_modules
      // junction, which the native resolver cannot follow reliably on Windows.
      cwd: path.resolve(__dirname, '..'),
      rspeedyConfig: {
        mode: 'production',
        source: { entry: { main: path.join(cwd, 'src/index.jsx') } },
        output: {
          dataUriLimit: 0,
          sourceMap: false,
          distPath: { root: path.join(cwd, 'dist') },
        },
        plugins: [pluginReactLynx(), pluginServerBundle()],
      },
    })
    await rspeedy.build()
    const files = unzipSync(await readFile(path.join(cwd, 'dist/dist.zip')))
    expect(files['main.lynx.bundle']?.byteLength).toBeGreaterThan(100)
    expect(Object.keys(files).some(name => name.endsWith('.png'))).toBe(true)
    expect(await readdir(path.join(cwd, 'dist'))).toEqual(['dist.zip'])
  })

  test('supports a custom output directory, filename, and nested environments', async () => {
    const cwd = await fixture()
    const rsbuild = await createRsbuild({
      cwd,
      rsbuildConfig: {
        ...config(),
        output: { ...config().output, distPath: { root: 'output' } },
        environments: {
          first: {},
          second: { output: { distPath: { root: 'output/second' } } },
        },
        plugins: [pluginServerBundle({ filename: 'page.zip' })],
      },
    })
    await rsbuild.build()
    const files = unzipSync(await readFile(path.join(cwd, 'output/page.zip')))
    expect(Object.keys(files)).toContain('second/main.js')
    expect(Buffer.from(files['second/main.js']!).toString()).toContain(
      'zip:///second/',
    )
    expect(Buffer.from(files['main.js']!).toString()).toContain('zip:///')
    expect(await readdir(path.join(cwd, 'output'))).toEqual(['page.zip'])
  })
  test('replaces production output, including chunks and public assets, with a rootless ZIP', async () => {
    const cwd = await fixture()
    const rsbuild = await createRsbuild({ cwd, rsbuildConfig: config() })
    await rsbuild.build()
    expect(await readdir(path.join(cwd, 'dist'))).toEqual(['dist.zip'])
    const archive = await readFile(path.join(cwd, 'dist/dist.zip'))
    const files = unzipSync(archive)
    expect(Buffer.from(files['extra.txt']!).toString()).toBe('public asset')
    expect(Object.keys(files).some(name => name.endsWith('.png'))).toBe(true)
    const scripts = Object.entries(files).filter(([name]) =>
      name.endsWith('.js')
    )
    expect(scripts.length).toBeGreaterThan(1)
    const script = scripts.map(([, bytes]) => Buffer.from(bytes).toString())
      .join('\n')
    expect(script).toContain('zip:///')
    expect(script).not.toContain('https://cdn.example.com/')
    expect(Object.keys(files).every(name => !name.startsWith('dist/'))).toBe(
      true,
    )
  })

  test.each(['development', 'none'] as const)(
    'leaves %s builds unchanged',
    async mode => {
      const cwd = await fixture()
      const rsbuild = await createRsbuild({
        cwd,
        rsbuildConfig: { ...config(), mode },
      })
      await rsbuild.build()
      expect(existsSync(path.join(cwd, 'dist/dist.zip'))).toBe(false)
      expect(existsSync(path.join(cwd, 'dist/extra.txt'))).toBe(true)
    },
  )

  test('does not replace outputs or publicPath for dev --mode production', async () => {
    const cwd = await fixture()
    const rsbuild = await createRsbuild({ cwd, rsbuildConfig: config() })
    const server = await rsbuild.createDevServer()
    try {
      const rspackConfigs = await rsbuild.initConfigs()
      expect(rspackConfigs[0]?.output?.publicPath).not.toContain('zip:')
      expect(rsbuild.getNormalizedConfig().output.assetPrefix).toBe(
        'https://cdn.example.com/',
      )
      expect(existsSync(path.join(cwd, 'dist/dist.zip'))).toBe(false)
    } finally {
      await server.close()
    }
  })

  test('serves the ZIP in a fresh Rspeedy preview with development mode and a base path', async () => {
    const cwd = await fixture()
    const rsbuild = await createRsbuild({ cwd, rsbuildConfig: config() })
    await rsbuild.build()
    const archive = await readFile(path.join(cwd, 'dist/dist.zip'))
    vi.stubEnv('NODE_ENV', 'development')
    const rspeedy = await createRspeedy({
      cwd,
      rspeedyConfig: {
        source: { entry: { main: './src/index.js' } },
        server: { host: '127.0.0.1', port: 0, base: '/app' },
        plugins: [pluginServerBundle()],
      },
    })
    // Match the CLI, which initializes configs before calling preview().
    await rspeedy.initConfigs()
    expect(existsSync(rspeedy.context.distPath)).toBe(true)
    const { server, port } = await rspeedy.preview()
    try {
      const url = `http://127.0.0.1:${port}/app/dist.zip`
      const response = await fetch(`${url}?download=1`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/zip')
      expect(Buffer.from(await response.arrayBuffer())).toEqual(archive)
      const head = await fetch(url, { method: 'HEAD' })
      expect(head.status).toBe(200)
      expect(head.headers.get('content-length')).toBe(String(archive.length))
      expect(await head.text()).toBe('')
      const printUrls = rspeedy.getRsbuildConfig().server?.printUrls
      expect(typeof printUrls).toBe('function')
      if (typeof printUrls === 'function') {
        expect(
          printUrls({
            urls: [`http://127.0.0.1:${port}`],
            port,
            routes: [],
            protocol: 'http',
          }),
        )
          .toEqual([{ label: 'Zip', url }])
      }
      expect(await readdir(path.join(cwd, 'dist'))).toEqual(['dist.zip'])
    } finally {
      await server.close()
    }
  })

  test('preserves output when ZIP validation fails', async () => {
    const cwd = await fixture()
    for (let index = 0; index < 101; index++) {
      await writeFile(path.join(cwd, 'public', `${index}.txt`), 'file')
    }
    const rsbuild = await createRsbuild({ cwd, rsbuildConfig: config() })
    await expect(rsbuild.build()).rejects.toThrow('100 files')
    expect(existsSync(path.join(cwd, 'dist/extra.txt'))).toBe(true)
    expect(existsSync(path.join(cwd, 'dist/dist.zip'))).toBe(false)
  })

  test('keeps unchanged images and public files across watch rebuilds', async () => {
    const cwd = await fixture()
    const rsbuild = await createRsbuild({ cwd, rsbuildConfig: config() })
    const build = await rsbuild.build({ watch: true })
    const archivePath = path.join(cwd, 'dist/dist.zip')
    try {
      await vi.waitFor(() => expect(existsSync(archivePath)).toBe(true))
      await writeFile(
        path.join(cwd, 'src/lazy.js'),
        'export const message = "updated chunk"',
      )
      await vi.waitFor(async () => {
        const files = unzipSync(await readFile(archivePath))
        const scripts = Object.entries(files).filter(([name]) =>
          name.endsWith('.js')
        )
        expect(
          scripts.map(([, bytes]) => Buffer.from(bytes).toString()).join('\n'),
        ).toContain('updated chunk')
        expect(Buffer.from(files['extra.txt']!).toString()).toBe('public asset')
        expect(Object.keys(files).some(name => name.endsWith('.png'))).toBe(
          true,
        )
        expect(Object.keys(files).some(name => name.endsWith('.zip'))).toBe(
          false,
        )
        expect(await readdir(path.join(cwd, 'dist'))).toEqual(['dist.zip'])
      }, { timeout: 10_000 })
    } finally {
      await build.close()
    }
  })

  test('previews unpacked development output when no ZIP exists', async () => {
    const cwd = await fixture()
    const development: RsbuildConfig = {
      ...config(),
      mode: 'development',
      output: { ...config().output, target: 'web' },
    }
    const rsbuild = await createRsbuild({ cwd, rsbuildConfig: development })
    await rsbuild.build()
    const preview = await createRsbuild({ cwd, rsbuildConfig: development })
    const { server, port } = await preview.preview()
    try {
      const response = await fetch(`http://127.0.0.1:${port}/extra.txt`)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('public asset')
    } finally {
      await server.close()
    }
  })
})
