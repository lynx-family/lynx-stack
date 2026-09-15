// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'
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
import {
  DEFAULT_DSL,
  LIBRARY_TOOLS,
  TEMPLATES,
  lintTemplateOf,
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

// Published with the exact versions this workspace pins; a scaffold should
// take patch and minor updates on its own.
const versions = Object.fromEntries(
  Object.entries(devDependencies).map(([name, range]) => [
    name,
    /^\d/.test(range) ? `^${range}` : range,
  ]),
)

/**
 * Options of {@link createLynx}.
 *
 * @public
 */
export interface CreateLynxOptions {
  /**
   * Build the project with this tool instead of asking for one.
   */
  tool?: Tool | undefined

  /**
   * The name the CLI introduces itself with.
   *
   * @defaultValue 'lynx'
   */
  name?: string | undefined
}

// `copyFolder` merges a tool's package.json without pinning its
// `workspace:` ranges the way it pins a template's, so pin them here.
function pinVersions(distFolder: string): void {
  const file = path.join(distFolder, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<
    string,
    Record<string, string> | undefined
  >
  for (const field of ['dependencies', 'devDependencies']) {
    for (const name of Object.keys(pkg[field] ?? {})) {
      const version = versions[name]
      if (version !== undefined) {
        pkg[field]![name] = version
      }
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
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

export function createGetTemplateName(
  fixedTool: Tool | undefined,
  tool: Tool | undefined = fixedTool,
): (argv: Argv) => Promise<string> {
  return async function getTemplateName({ template }: Argv): Promise<string> {
    if (typeof template === 'string') {
      const resolved = resolveTemplateName(template)
      // A CLI pinned to one build tool must not be talked into another one
      // through `--template`.
      if (
        fixedTool && TEMPLATES.includes(resolved)
        && !resolved.startsWith(`${fixedTool}-`)
      ) {
        throw new Error(
          `Template "${template}" builds with ${
            resolved.split('-')[0] ?? ''
          }, and this CLI builds with ${fixedTool}. `
            + `Use \`npm create @lynx-js/lynx@latest\` to pick a build tool.`,
        )
      }
      return resolved
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

    return `${tool ?? (await selectTool())}-${DEFAULT_DSL}-${lang}`
  }
}

/**
 * Scaffold a Lynx project.
 *
 * @public
 */
export async function createLynx(
  options: CreateLynxOptions = {},
): Promise<void> {
  const tool = options.tool ?? (await resolveTool(process.argv.slice(2)))

  return create({
    root: templateRoot(packageRoot, tool),
    name: options.name ?? 'lynx',
    templates: options.tool
      ? TEMPLATES.filter(template => template.startsWith(`${options.tool}-`))
      : TEMPLATES,
    getTemplateName: createGetTemplateName(options.tool, tool),
    version: versions,
    extraTools: [
      {
        value: 'external-bundle',
        label: 'External Bundle',
        order: 'pre',
        when: ({ templateName }) => {
          const tool = toolOf(templateName)
          return tool !== undefined && LIBRARY_TOOLS.includes(tool)
        },
        action: ({ templateName, distFolder, addAgentsMdSearchDirs }) => {
          const from = path.join(
            templateRoot(packageRoot, toolOf(templateName)),
            `template-external-bundle-${templateName.split('-').at(-1)}`,
          )
          copyFolder({
            from,
            to: distFolder,
            isMergePackageJson: true,
          })
          pinVersions(distFolder)
          addAgentsMdSearchDirs(from)
        },
      },
      {
        value: 'rslint',
        label: 'Rslint - linting',
        order: 'pre',
        action: ({ templateName, distFolder, addAgentsMdSearchDirs }) => {
          const root = path.join(packageRoot, 'template-rslint')
          const config = lintTemplateOf(templateName)
          if (config === null) {
            return
          }
          copyFolder({
            from: path.join(root, config),
            to: distFolder,
            isMergePackageJson: true,
          })
          addAgentsMdSearchDirs(root)
        },
      },
    ],
    builtinTools: ['eslint', 'biome', 'prettier'],
    extraSkills: [
      {
        label: 'Lynx DevTool',
        source: 'lynx-community/skills',
        value: 'lynx-devtool',
      },
    ],
    mapESLintTemplate: lintTemplateOf,
  })
}
