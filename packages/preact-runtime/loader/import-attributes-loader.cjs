// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Rewrites the nonstandard `import(expr, { with: { ... } })` form (lazy /
 * producer bundles) into a call to the runtime's `__preactRemoteImport`.
 * This is a syntax-surface shim, not a code transform: standard dynamic
 * imports pass through untouched.
 */

'use strict';

const IMPORT_WITH_RE =
  /\bimport\s*\(([^;{}]+),\s*\{\s*with\s*:\s*\{[^{}]*\}[\s,]*\}\s*\)/g;

/** @type {import('@rspack/core').LoaderDefinitionFunction} */
module.exports = function importAttributesLoader(source) {
  if (!source.includes('with')) {
    return source;
  }
  return source.replace(
    IMPORT_WITH_RE,
    (_match, expr) => `globalThis.__preactRemoteImport(${expr.trim()})`,
  );
};
