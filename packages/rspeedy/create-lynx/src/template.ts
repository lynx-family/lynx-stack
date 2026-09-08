// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export type Tool = 'rsbuild' | 'rspeedy'
export type Lang = 'js' | 'ts'

export const TOOLS: Tool[] = ['rsbuild', 'rspeedy']
export const LANGS: Lang[] = ['ts', 'js']

export const TEMPLATES = TOOLS.flatMap(tool =>
  LANGS.map(lang => `${tool}-${lang}`)
)

// `create-rspeedy` named its templates after the DSL instead of the build tool.
const LEGACY_TOOL_ALIAS: Record<string, Tool> = {
  react: 'rspeedy',
}

function isTool(value: string): value is Tool {
  return (TOOLS as string[]).includes(value)
}

function isLang(value: string): value is Lang {
  return (LANGS as string[]).includes(value)
}

/**
 * Resolve a `--template` value to a template directory name.
 *
 * Returns the input unchanged when it names neither a tool nor a legacy alias,
 * which lets `create` fall through to its npm template branch.
 */
export function resolveTemplateName(template: string): string {
  const parts = template.split('-')
  const lang = parts[parts.length - 1]
  const name = parts.slice(0, -1).join('-')
  const tool = LEGACY_TOOL_ALIAS[name] ?? name

  if (isTool(tool) && isLang(lang)) {
    return `${tool}-${lang}`
  }

  const bare = LEGACY_TOOL_ALIAS[template] ?? template
  if (isTool(bare)) {
    return `${bare}-ts`
  }

  return template
}
