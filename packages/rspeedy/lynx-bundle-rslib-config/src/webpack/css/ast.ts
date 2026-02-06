// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as CSS from '@lynx-js/css-serializer'
import type { Plugin } from '@lynx-js/css-serializer'

export function cssToAst(
  content: string,
  plugins: Plugin[],
): [CSS.LynxStyleNode[], CSS.ParserError[]] {
  const parsedCSS = CSS.parse(content, {
    plugins,
  })
  return [parsedCSS.root, parsedCSS.errors] as const
}
