// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** The build tool a template drives. */
export type Tool = 'rsbuild' | 'rspeedy'

/** The DSL a template is written in. */
export type Dsl = 'react'

export type Lang = 'js' | 'ts'

export const TOOLS: Tool[] = ['rsbuild', 'rspeedy']
export const DSLS: Dsl[] = ['react']
export const LANGS: Lang[] = ['ts', 'js']

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

  const tool = LEGACY_TOOL[parts[0] ?? ''] ?? parts[0] ?? ''
  if (!isTool(tool)) {
    return template
  }

  const rest = LEGACY_TOOL[parts[0] ?? ''] ? parts : parts.slice(1)
  const dsl = rest.find(part => isDsl(part)) ?? DEFAULT_DSL
  const lang = rest.find(part => isLang(part)) ?? DEFAULT_LANG

  return `${tool}-${dsl}-${lang}`
}
