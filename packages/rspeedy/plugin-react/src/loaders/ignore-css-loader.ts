// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'

export default function ignoreCssLoader(
  this: Rspack.LoaderContext,
  source: string,
): string {
  this.cacheable(true) // cSpell:disable-line

  // if the source code include '___CSS_LOADER_EXPORT___'
  // It is not a CSS Modules file because exportOnlyLocals is enabled,
  // so we don't need to preserve it.
  if (source.includes('___CSS_LOADER_EXPORT___')) {
    // Return an ESM to make sure the module strict.
    // See: https://github.com/webpack/webpack/discussions/18367#discussion-6580398
    return 'export {}'
  }

  // Preserve css modules export for background layer.
  return source
}
