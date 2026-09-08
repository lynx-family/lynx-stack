// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
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

  it('defaults a bare tool name to TypeScript', () => {
    for (const tool of TOOLS) {
      expect(resolveTemplateName(tool)).toBe(`${tool}-ts`)
    }
  })

  // `create-rspeedy` is superseded by this package, so the template names it
  // documented have to keep working.
  it('maps the create-rspeedy template names onto Rspeedy', () => {
    expect(resolveTemplateName('react-ts')).toBe('rspeedy-ts')
    expect(resolveTemplateName('react-js')).toBe('rspeedy-js')
    expect(resolveTemplateName('react')).toBe('rspeedy-ts')
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
      for (const lang of LANGS) {
        const manifest = JSON.parse(
          fs.readFileSync(
            path.join(packageRoot, `template-${tool}-${lang}`, 'package.json'),
            'utf-8',
          ),
        ) as { scripts: Record<string, string> }

        expect(manifest.scripts['build']).toBe(`${tool} build`)
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
