// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core';

export default function ignoreCssLoader(
  this: Rspack.LoaderContext,
  source: string,
): string {
  this.cacheable(true);

  // If the source contains ___CSS_LOADER_EXPORT___, it is not a CSS Modules
  // file (exportOnlyLocals is enabled), so we don't need to preserve it.
  if (source.includes('___CSS_LOADER_EXPORT___')) {
    return 'export {}';
  }

  // Preserve CSS modules export for background layer.
  return source;
}
