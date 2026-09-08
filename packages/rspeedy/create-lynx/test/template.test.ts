// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  DSLS,
  LANGS,
  TEMPLATES,
  TOOLS,
  resolveTemplateName,
} from '../src/template.js'

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

describe('resolveTemplateName', () => {
  it('resolves every advertised template to itself', () => {
    for (const template of TEMPLATES) {
      expect(resolveTemplateName(template)).toBe(template)
    }
  })

  it('fills in the DSL and the language that are left out', () => {
    for (const tool of TOOLS) {
      expect(resolveTemplateName(tool)).toBe(`${tool}-react-ts`)
      expect(resolveTemplateName(`${tool}-js`)).toBe(`${tool}-react-js`)
      expect(resolveTemplateName(`${tool}-react`)).toBe(`${tool}-react-ts`)
    }
  })

  // `create-rspeedy` is superseded by this package, so the template names it
  // documented have to keep working.
  it('maps the create-rspeedy template names onto Rspeedy', () => {
    expect(resolveTemplateName('react-ts')).toBe('rspeedy-react-ts')
    expect(resolveTemplateName('react-js')).toBe('rspeedy-react-js')
    expect(resolveTemplateName('react')).toBe('rspeedy-react-ts')
  })

  // A name like `rsbuild-ttml-ts` must not quietly scaffold React.
  it('rejects a component that names no known DSL or language', () => {
    expect(() => resolveTemplateName('rsbuild-vue-js')).toThrow(/"vue"/)
    expect(() => resolveTemplateName('rsbuild-ttml-ts')).toThrow(/"ttml"/)
    expect(() => resolveTemplateName('rspeedy-svelte')).toThrow(/"svelte"/)
  })

  it('passes an npm package name through untouched', () => {
    expect(resolveTemplateName('@scope/some-template')).toBe(
      '@scope/some-template',
    )
  })
})

describe('templates on disk', () => {
  it('ships a directory for every advertised template', () => {
    for (const template of TEMPLATES) {
      expect(
        fs.existsSync(path.join(packageRoot, `template-${template}`)),
      ).toBe(true)
    }
  })

  it('builds each template with its own tool', () => {
    for (const tool of TOOLS) {
      for (const dsl of DSLS) {
        for (const lang of LANGS) {
          const manifest = JSON.parse(
            fs.readFileSync(
              path.join(
                packageRoot,
                `template-${tool}-${dsl}-${lang}`,
                'package.json',
              ),
              'utf-8',
            ),
          ) as { scripts: Record<string, string> }

          expect(manifest.scripts['build']).toBe(`${tool} build`)
        }
      }
    }
  })

  it('does not leave unresolvable ranges in a template manifest', () => {
    const versions = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8'),
    ) as { devDependencies: Record<string, string> }

    for (const template of TEMPLATES) {
      const manifest = JSON.parse(
        fs.readFileSync(
          path.join(packageRoot, `template-${template}`, 'package.json'),
          'utf-8',
        ),
      ) as Record<string, Record<string, string> | undefined>

      for (const field of ['dependencies', 'devDependencies']) {
        for (const [name, range] of Object.entries(manifest[field] ?? {})) {
          if (
            !range.startsWith('workspace:') && !range.startsWith('catalog:')
          ) {
            continue
          }
          expect(
            versions.devDependencies,
            `${template} depends on ${name}, so it must be pinned by this package`,
          ).toHaveProperty(name)
        }
      }
    }
  })
})
