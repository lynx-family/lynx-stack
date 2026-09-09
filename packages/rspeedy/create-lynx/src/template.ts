// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'

/** The build tool a template drives. */
export type Tool = 'rsbuild' | 'rspeedy' | 'rslib'

/** The DSL a template is written in. */
export type Dsl = 'react'

export type Lang = 'js' | 'ts'

export const TOOLS: Tool[] = ['rsbuild', 'rspeedy', 'rslib']
export const DSLS: Dsl[] = ['react']
export const LANGS: Lang[] = ['ts', 'js']

/** The tools that scaffold a library rather than an app. */
export const LIBRARY_TOOLS: Tool[] = ['rslib']

export const DEFAULT_DSL: Dsl = 'react'
export const DEFAULT_LANG: Lang = 'ts'

export const TEMPLATES: string[] = TOOLS.flatMap(tool =>
  DSLS.flatMap(dsl => LANGS.map(lang => `${tool}-${dsl}-${lang}`))
)

// `create-rspeedy` only ever built with Rspeedy, so it named its templates
// after the DSL alone.
const LEGACY_TOOL: Record<string, Tool> = {
  react: 'rspeedy',
}

function isTool(value: string): value is Tool {
  return (TOOLS as string[]).includes(value)
}

function isDsl(value: string): value is Dsl {
  return (DSLS as string[]).includes(value)
}

function isLang(value: string): value is Lang {
  return (LANGS as string[]).includes(value)
}

/** The tool a resolved template name builds with, if it names one. */
export function toolOf(template: string): Tool | undefined {
  const head = template.split('-')[0] ?? ''
  return isTool(head) ? head : undefined
}

/**
 * The directory that holds `template-common` and the `template-*` directories
 * of a tool. Apps and libraries share nothing but the scaffolder, so each kind
 * keeps its own `template-common`.
 */
export function templateRoot(
  packageRoot: string,
  tool: Tool | undefined,
): string {
  return tool !== undefined && LIBRARY_TOOLS.includes(tool)
    ? path.join(packageRoot, 'library')
    : packageRoot
}

/**
 * Resolve a `--template` value to a template directory name.
 *
 * Accepts `<tool>-<dsl>-<lang>` and fills in the parts that are left out, so
 * `rsbuild`, `rsbuild-ts` and `rsbuild-react-ts` all name the same template.
 * Returns the input unchanged when it names no known tool, which lets `create`
 * fall through to its npm template branch.
 */
export function resolveTemplateName(template: string): string {
  const parts = template.split('-')
  const head = parts[0] ?? ''
  const tool = LEGACY_TOOL[head] ?? head

  if (!isTool(tool)) {
    return template
  }

  // A legacy name carries no tool of its own, so all of it names the rest.
  const rest = LEGACY_TOOL[head] ? parts : parts.slice(1)
  const unknown = rest.filter(part => !isDsl(part) && !isLang(part))

  if (unknown.length > 0) {
    throw new Error(
      `Invalid template "${template}": ${
        unknown.map(part => `"${part}"`).join(', ')
      } names neither a DSL (${DSLS.join(', ')}) nor a language (${
        LANGS.join(', ')
      }). Available templates: ${TEMPLATES.join(', ')}.`,
    )
  }

  const dsl = rest.find(part => isDsl(part)) ?? DEFAULT_DSL
  const lang = rest.find(part => isLang(part)) ?? DEFAULT_LANG

  return `${tool}-${dsl}-${lang}`
}
