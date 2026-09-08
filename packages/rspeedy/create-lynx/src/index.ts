#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Argv } from '@rstackjs/create-toolkit'
import {
  checkCancel,
  copyFolder,
  create,
  select,
} from '@rstackjs/create-toolkit'

import type { Lang, Tool } from './template.js'
import { DEFAULT_DSL, TEMPLATES, resolveTemplateName } from './template.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// eslint-disable-next-line import/no-commonjs
const { devDependencies } = require('../package.json') as {
  devDependencies: Record<string, string>
}

async function getTemplateName({ template }: Argv) {
  if (typeof template === 'string') {
    return resolveTemplateName(template)
  }

  const tool = checkCancel<Tool>(
    await select({
      message: 'Select build tool',
      options: [
        { value: 'rsbuild', label: 'Rsbuild', hint: 'recommended' },
        { value: 'rspeedy', label: 'Rspeedy' },
      ],
    }),
  )

  const lang = checkCancel<Lang>(
    await select({
      message: 'Select language',
      options: [
        { value: 'ts', label: 'TypeScript', hint: 'recommended' },
        { value: 'js', label: 'JavaScript' },
      ],
    }),
  )

  return `${tool}-${DEFAULT_DSL}-${lang}`
}

void create({
  root: path.resolve(__dirname, '..'),
  name: 'lynx',
  templates: TEMPLATES,
  version: devDependencies,
  getTemplateName,
  extraTools: [
    {
      value: 'vitest-rltl',
      label: 'Vitest',
      order: 'pre',
      action: ({ distFolder, addAgentsMdSearchDirs }) => {
        const from = path.resolve(__dirname, '..', 'template-react-vitest-rltl')
        copyFolder({
          from,
          to: distFolder,
          isMergePackageJson: true,
        })
        addAgentsMdSearchDirs(from)
      },
    },
    {
      value: 'rstest-rltl',
      label: 'Rstest',
      order: 'pre',
      action: ({ distFolder, addAgentsMdSearchDirs }) => {
        const from = path.resolve(__dirname, '..', 'template-react-rstest-rltl')
        copyFolder({
          from,
          to: distFolder,
          isMergePackageJson: true,
        })
        addAgentsMdSearchDirs(from)
      },
    },
  ],
  extraSkills: [
    {
      label: 'Lynx DevTool',
      source: 'lynx-community/skills',
      value: 'lynx-devtool',
    },
  ],
  mapESLintTemplate(templateName) {
    const lang = templateName.split('-').at(-1)
    return lang === 'js' || lang === 'ts' ? `react-${lang}` : null
  },
})
