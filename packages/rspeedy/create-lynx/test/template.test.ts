// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from '@rstest/core'

import {
  DSLS,
  LANGS,
  LIBRARY_TOOLS,
  TEMPLATES,
  TOOLS,
  resolveTemplateName,
  templateRoot,
  toolOf,
} from '../src/template.js'

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

function templateDir(template: string): string {
  return path.join(
    templateRoot(packageRoot, toolOf(template)),
    `template-${template}`,
  )
}

function readManifest(dir: string): Record<string, Record<string, string>> {
  return JSON.parse(
    fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'),
  ) as Record<string, Record<string, string>>
}

describe('resolveTemplateName', () => {
  test('resolves every advertised template to itself', () => {
    for (const template of TEMPLATES) {
      expect(resolveTemplateName(template)).toBe(template)
    }
  })

  test('fills in the DSL and the language that are left out', () => {
    for (const tool of TOOLS) {
      expect(resolveTemplateName(tool)).toBe(`${tool}-react-ts`)
      expect(resolveTemplateName(`${tool}-js`)).toBe(`${tool}-react-js`)
      expect(resolveTemplateName(`${tool}-react`)).toBe(`${tool}-react-ts`)
    }
  })

  // `create-rspeedy` is superseded by this package, so the template names it
  // documented have to keep working.
  test('maps the create-rspeedy template names onto Rspeedy', () => {
    expect(resolveTemplateName('react-ts')).toBe('rspeedy-react-ts')
    expect(resolveTemplateName('react-js')).toBe('rspeedy-react-js')
    expect(resolveTemplateName('react')).toBe('rspeedy-react-ts')
  })

  // A name like `rsbuild-ttml-ts` must not quietly scaffold React.
  test('rejects a component that names no known DSL or language', () => {
    expect(() => resolveTemplateName('rsbuild-vue-js')).toThrow(/"vue"/)
    expect(() => resolveTemplateName('rsbuild-ttml-ts')).toThrow(/"ttml"/)
    expect(() => resolveTemplateName('rspeedy-svelte')).toThrow(/"svelte"/)
  })

  test('passes an npm package name through untouched', () => {
    expect(resolveTemplateName('@scope/some-template')).toBe(
      '@scope/some-template',
    )
    expect(toolOf('@scope/some-template')).toBeUndefined()
  })
})

describe('templateRoot', () => {
  test('keeps apps and libraries in their own template root', () => {
    expect(templateRoot(packageRoot, 'rsbuild')).toBe(packageRoot)
    expect(templateRoot(packageRoot, 'rspeedy')).toBe(packageRoot)
    expect(templateRoot(packageRoot, 'rslib')).toBe(
      path.join(packageRoot, 'library'),
    )
    expect(templateRoot(packageRoot, undefined)).toBe(packageRoot)
  })

  test('gives each root its own template-common', () => {
    for (const tool of TOOLS) {
      expect(
        fs.existsSync(
          path.join(templateRoot(packageRoot, tool), 'template-common'),
        ),
      ).toBe(true)
    }
  })
})

describe('templates on disk', () => {
  test('ships a directory for every advertised template', () => {
    for (const template of TEMPLATES) {
      expect(fs.existsSync(templateDir(template))).toBe(true)
    }
  })

  test('builds each template with its own tool', () => {
    for (const tool of TOOLS) {
      for (const dsl of DSLS) {
        for (const lang of LANGS) {
          const manifest = readManifest(templateDir(`${tool}-${dsl}-${lang}`))
          expect(manifest['scripts']?.['build']).toBe(`${tool} build`)
        }
      }
    }
  })

  test('tests every template with Rstest', () => {
    for (const template of TEMPLATES) {
      const manifest = readManifest(templateDir(template))
      expect(manifest['scripts']?.['test']).toBe('rstest run')
      expect(manifest['devDependencies']).toHaveProperty('@rstest/core')
    }
  })

  test('declares ReactLynx as a peer of a library', () => {
    for (const tool of LIBRARY_TOOLS) {
      for (const lang of LANGS) {
        const manifest = readManifest(templateDir(`${tool}-react-${lang}`))
        expect(manifest['peerDependencies']).toHaveProperty('@lynx-js/react')
        expect(manifest['dependencies']).toBeUndefined()
      }
    }
  })

  test('packs a library into an External Bundle on request', () => {
    for (const tool of LIBRARY_TOOLS) {
      for (const lang of LANGS) {
        const manifest = readManifest(
          path.join(
            templateRoot(packageRoot, tool),
            `template-external-bundle-${lang}`,
          ),
        )
        expect(manifest['scripts']?.['build:external-bundle']).toMatch(
          /^rslib build --config /,
        )
      }
    }
  })

  // `src/index.ts` turns each version into a caret range when it scaffolds, so
  // a range here would reach the generated project twice.
  test('pins every version exactly', () => {
    const versions = readManifest(packageRoot)['devDependencies'] ?? {}

    for (const [name, range] of Object.entries(versions)) {
      expect(
        /^(?:\d|workspace:\*$|catalog:)/.test(range),
        `${name} is "${range}", but this package may only pin an exact version, `
          + 'workspace:* or catalog:',
      ).toBe(true)
    }
  })

  // A template only names its dependencies; the versions come from this
  // package, so one bump here reaches every template.
  test('pins every template dependency in this package', () => {
    const versions = readManifest(packageRoot)['devDependencies'] ?? {}
    const dirs = [
      ...TEMPLATES.map(template => templateDir(template)),
      ...LIBRARY_TOOLS.flatMap(tool =>
        LANGS.map(lang =>
          path.join(
            templateRoot(packageRoot, tool),
            `template-external-bundle-${lang}`,
          )
        )
      ),
    ]

    for (const dir of dirs) {
      const template = path.basename(dir)
      const manifest = readManifest(dir)

      for (const field of ['dependencies', 'devDependencies']) {
        for (const [name, range] of Object.entries(manifest[field] ?? {})) {
          expect(
            range,
            `${template} must leave the version of ${name} to this package`,
          ).toBe('workspace:*')
          expect(
            versions,
            `${template} depends on ${name}, so it must be pinned by this package`,
          ).toHaveProperty(name)
        }
      }
    }
  })
})
