// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Derive the compile-time host id of a runtime chunk's entry
 * (`uniqueName#entryName`).
 *
 * `LynxAsyncChunksRuntimeModule` (template-webpack-plugin) emits it as
 * {@link RuntimeGlobals.lynxHostId} for chunk loading to pass as a nested
 * lazy-bundle import's `host`, and `LynxProcessEvalResultRuntimeModule`
 * (react-webpack-plugin) keys `processEvalResultByHost` with it — both must
 * derive the identical id. Main-thread entries are named
 * `${entryName}__main-thread` while background entries are the bare
 * `entryName`, so stripping the suffix pairs the two runtimes of one entry.
 *
 * @param uniqueName - `compilation.outputOptions.uniqueName`
 * @param runtime - the runtime spec of the chunk (`chunk.runtime`)
 *
 * @public
 */
export function deriveLynxHostId(
  uniqueName: string | undefined,
  runtime: string | Iterable<string> | undefined,
): string {
  const runtimes = typeof runtime === 'string'
    ? [runtime]
    : Array.from(runtime ?? []);
  const entryName = runtimes
    .map(name => name.replace(/__main-thread$/, ''))
    .join('+');
  return `${uniqueName ?? ''}#${entryName}`;
}
