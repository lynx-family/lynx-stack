#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Argv } from '@rstackjs/create-toolkit'
import { checkCancel, create, select } from '@rstackjs/create-toolkit'

import type { Lang, Tool } from './template.js'
import {
  DEFAULT_DSL,
  TEMPLATES,
  resolveTemplateName,
  templateRoot,
  toolOf,
} from './template.js'

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const require = createRequire(import.meta.url)

// eslint-disable-next-line import/no-commonjs
const { devDependencies } = require('../package.json') as {
  devDependencies: Record<string, string>
}

function templateArg(argv: string[]): string | undefined {
  for (const [index, arg] of argv.entries()) {
    if (arg === '--template' || arg === '-t') {
      return argv[index + 1]
    }
    if (arg.startsWith('--template=')) {
      return arg.slice('--template='.length)
    }
  }
  return undefined
}

async function selectTool(): Promise<Tool> {
  return checkCancel<Tool>(
    await select({
      message: 'Select build tool',
      options: [
        { value: 'rsbuild', label: 'Rsbuild', hint: 'app, recommended' },
        { value: 'rspeedy', label: 'Rspeedy', hint: 'app' },
        { value: 'rslib', label: 'Rslib', hint: 'library' },
      ],
    }),
  )
}

// The tool picks the template root, so it is settled before `create` takes
// over the prompts.
function resolveTool(argv: string[]): Tool | undefined | Promise<Tool> {
  const template = templateArg(argv)
  if (template !== undefined) {
    return toolOf(resolveTemplateName(template))
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    return undefined
  }
  return selectTool()
}

const tool = await resolveTool(process.argv.slice(2))

void create({
  root: templateRoot(packageRoot, tool),
  name: 'lynx',
  templates: TEMPLATES,
  version: devDependencies,
  async getTemplateName({ template }: Argv) {
    if (typeof template === 'string') {
      return resolveTemplateName(template)
    }

    const lang = checkCancel<Lang>(
      await select({
        message: 'Select language',
        options: [
          { value: 'ts', label: 'TypeScript', hint: 'recommended' },
          { value: 'js', label: 'JavaScript' },
        ],
      }),
    )

    return `${tool ?? 'rsbuild'}-${DEFAULT_DSL}-${lang}`
  },
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
