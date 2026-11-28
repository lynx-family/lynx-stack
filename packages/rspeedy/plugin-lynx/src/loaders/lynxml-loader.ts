// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rspack } from '@rsbuild/core'

import { parseLynxXML } from '@lynx-js/lynx-xml/parser'

export default function lynxmlLoader(
  this: Rspack.LoaderContext<{
    section: 'main' | 'background' | 'style'
    includeStyle?: boolean
  }>,
  source: string,
): string {
  const parsed = parseLynxXML(source)
  if (!parsed.success) throw new Error(parsed.error.formattedMessage)

  const { section, includeStyle } = this.getOptions()
  if (section === 'style') return parsed.style ?? ''
  const script = section === 'main'
    ? parsed.mainThreadScript
    : parsed.backgroundThreadScript ?? ''
  if (!includeStyle || parsed.style === undefined) return script

  // Match the normal CSS pipeline while resolving URLs beside the original XML.
  const loader = this.loaders[this.loaderIndex]!.path
  const style =
    `${this.resourcePath}.css!=!${loader}?{"section":"style"}!${this.resource}`
  return `${script}\n;require(${JSON.stringify(style)});\n`
}
