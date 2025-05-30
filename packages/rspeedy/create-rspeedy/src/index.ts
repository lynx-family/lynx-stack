#!/usr/bin/env node

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Argv } from 'create-rstack'
import { checkCancel, create, multiselect, select } from 'create-rstack'

type LANG = 'js' | 'ts'
type FRAMEWORK = 'react' | 'vue'

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
  { template: 'vue', tools: {}, lang: 'ts' },
  { template: 'vue', tools: {}, lang: 'js' },
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
    template: framework,
    lang: language,
    tools: Object.fromEntries(
      tools.map((tool) => [tool, tool]),
    ),
  })
}

void create({
  root: path.resolve(__dirname, '..'),
  name: 'rspeedy',
  templates: TEMPLATES.map(({ template, tools, lang }) =>
    composeTemplateName({ template, lang, tools })
  ),
  version: devDependencies,
  getTemplateName,
  mapESLintTemplate() {
    // TODO: support ESLint later
    return null
  },
})
