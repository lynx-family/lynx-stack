#!/usr/bin/env node

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Argv } from 'create-rstack'
import { checkCancel, copyFolder, create, select } from 'create-rstack'

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
}

const composeTemplateName = ({
  template,
  lang,
}: {
  template: string
  lang: LANG
}) => {
  return `${template}-${lang}`
}

const TEMPLATES: Template[] = [
  { template: 'react', lang: 'ts' },
  { template: 'react', lang: 'js' },
] as const

async function getTemplateName({ template }: Argv) {
  if (typeof template === 'string') {
    const pair = template.split('-')
    const lang = pair[pair.length - 1]
    if (lang && ['js', 'ts'].includes(lang)) {
      if (pair[0] === 'react') {
        return `react-${lang}`
      }
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

  return composeTemplateName({
    template: 'react',
    lang: language,
  })
}

void create({
  root: path.resolve(__dirname, '..'),
  name: 'rspeedy',
  templates: TEMPLATES.map(({ template, lang }) =>
    composeTemplateName({ template, lang })
  ),
  version: devDependencies,
  getTemplateName,
  extraTools: [
    {
      value: 'vitest-rltl',
      label: 'Vitest',
      order: 'pre',
      when: (templateName) =>
        templateName === 'react-js' || templateName === 'react-ts',
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
      when: (templateName) =>
        templateName === 'react-js' || templateName === 'react-ts',
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
  mapESLintTemplate(templateName) {
    const lang = templateName.split('-').at(-1)

    if (lang !== 'js' && lang !== 'ts') return null

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
