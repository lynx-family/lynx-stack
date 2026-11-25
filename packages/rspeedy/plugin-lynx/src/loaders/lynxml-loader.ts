// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'

import { parseLynxXML } from '@lynx-js/lynx-xml/parser'

export default function lynxmlLoader(
  this: Rspack.LoaderContext<{ section: 'main' | 'background' | 'style' }>,
  source: string,
): string {
  const parsed = parseLynxXML(source)
  if (!parsed.success) {
    throw new Error(parsed.error.formattedMessage)
  }

  const { section } = this.getOptions()
  if (section === 'style') return parsed.style ?? ''
  if (section === 'background') return parsed.backgroundThreadScript ?? ''

  if (parsed.style === undefined) return parsed.mainThreadScript

  // Match as CSS to reuse the configured CSS pipeline, then extract the raw
  // stylesheet before those loaders run. The real resource stays the XML file
  // so relative imports, assets, and rebuild dependencies resolve beside it.
  const loader = this.loaders[this.loaderIndex]!.path
  const request = `${this.resourcePath}.css!=!${loader}?${
    JSON.stringify({ section: 'style' })
  }!${this.resource}`
  return `import ${JSON.stringify(request)};\n${parsed.mainThreadScript}`
}
