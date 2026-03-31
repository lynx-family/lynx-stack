#!/usr/bin/env node

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Argv } from 'create-rstack'
import { checkCancel, create, multiselect, select } from 'create-rstack'

import { isNpmTemplate, resolveCustomTemplate } from './template-manager.js'

type LANG = 'js' | 'ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// We cannot use `import()/import with` due to it is still experimental in Node.js 18
// eslint-disable-next-line import/no-commonjs
const { devDependencies } = require('../package.json') as {
  devDependencies: Record<string, string>
}

interface Template {
  template: string
  lang: LANG
  tools?: Record<string, string> | undefined
}

const composeTemplateName = ({
  template,
  tools,
  lang,
}: {
  template: string
  tools?: Record<string, string> | undefined
  lang: LANG
}) => {
  const toolsKeys = (tools ? Object.keys(tools) : []).sort()
  const toolsStr = toolsKeys.length > 0 ? `-${toolsKeys.join('-')}` : ''
  return `${template}${toolsStr}-${lang}`
}

const TEMPLATES: Template[] = [
  { template: 'react', tools: {}, lang: 'ts' },
  { template: 'react', tools: {}, lang: 'js' },
] as const

async function getTemplateName({ template }: Argv) {
  if (typeof template === 'string') {
    const pair = template.split('-')
    const lang = pair[pair.length - 1]
    if (lang && ['js', 'ts'].includes(lang)) {
      return template
    }
    // default to ts
    return `${template}-ts`
  }

  const language = checkCancel<LANG>(
    await select({
      message: 'Select language',
      options: [
        { value: 'ts', label: 'TypeScript', hint: 'recommended' },
        { value: 'js', label: 'JavaScript' },
      ],
    }),
  )

  const tools = checkCancel<string[]>(
    await multiselect({
      message:
        'Select development tools (Use <space> to select, <enter> to continue)',
      required: false,
      options: [
        {
          value: 'vitest-rltl',
          label: 'Add ReactLynx Testing Library for unit testing',
        },
      ],
      initialValues: [
        'vitest-rltl',
      ],
    }),
  )

  return composeTemplateName({
    template: 'react',
    lang: language,
    tools: Object.fromEntries(
      tools.map((tool) => [tool, tool]),
    ),
  })
}

// Extended Argv with template version support
interface ExtendedArgv extends Argv {
  templateVersion?: string
  'template-version'?: string
}

// Parse CLI arguments to extract template version
function parseArgv(): ExtendedArgv {
  const argv = process.argv.slice(2)
  const result: ExtendedArgv = {}

  for (const arg of argv) {
    const index = argv.indexOf(arg)
    if (arg === '--template-version' || arg === '--tv') {
      result.templateVersion = argv[index + 1]
      result['template-version'] = result.templateVersion
    } else if (arg === '--template' || arg === '-t') {
      result.template = argv[index + 1]
    } else if (arg === '--dir' || arg === '-d') {
      result.dir = argv[index + 1]
    } else if (!arg.startsWith('-') && !result.dir) {
      result.dir = arg
    }
  }

  return result
}

// Main entry point
async function main() {
  const argv = parseArgv()

  // Handle npm template specially
  if (typeof argv.template === 'string' && isNpmTemplate(argv.template)) {
    const templateVersion = argv.templateVersion ?? argv['template-version']
    const templatePath = resolveCustomTemplate(
      argv.template,
      templateVersion,
    )

    // Create a temporary template directory name
    const templateName = `npm-${Date.now()}`

    // Copy npm template to a temporary local template directory
    const tempTemplateDir = path.join(
      path.resolve(__dirname, '..'),
      `template-${templateName}`,
    )

    // Copy the resolved template to our template directory
    const fs = await import('node:fs')
    fs.cpSync(templatePath, tempTemplateDir, { recursive: true })

    // Call create with the temporary template
    await create({
      root: path.resolve(__dirname, '..'),
      name: 'rspeedy',
      templates: [templateName],
      version: devDependencies,
      getTemplateName: async () => templateName,
      mapESLintTemplate: () => null,
    })

    // Clean up temporary template directory
    fs.rmSync(tempTemplateDir, { recursive: true, force: true })
    return
  }

  // Standard create-rspeedy flow
  await create({
    root: path.resolve(__dirname, '..'),
    name: 'rspeedy',
    templates: TEMPLATES.map(({ template, tools, lang }) =>
      composeTemplateName({ template, lang, tools })
    ),
    version: devDependencies,
    getTemplateName,
    mapESLintTemplate(templateName) {
      const lang = TEMPLATES.find(({ template }) =>
        templateName.startsWith(template)
      )?.lang

      if (!lang) return null

      switch (lang) {
        case 'js':
          return 'react-js'
        case 'ts':
          return 'react-ts'
        default:
          return null
      }
    },
  })
}

void main()
