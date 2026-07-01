// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createHash } from 'node:crypto'

import type { Rspack } from '@rsbuild/core'

/**
 * A 160-bit release key: a SHA-1 (40 hex chars) over the given parts, NUL-joined
 * so they can't blur into one another. SHA-1 is used NOT for any security
 * property but because this is content-addressing, exactly like git's commit
 * ids: collisions here are random, not adversarial, so SHA-1's 2^80 birthday
 * bound is ample (collision probability stays ~1e-28 even at tens of billions of
 * keys) and the 40-hex digest matches a git commit hash with no truncation. The
 * banner and the artifact collector MUST pass identical parts so the
 * runtime-reported release matches the stored source-map `key`.
 */
export function computeReleaseKey(...parts: string[]): string {
  return createHash('sha1').update(parts.join('\0')).digest('hex')
}

/**
 * The artifact release key — baked into the runtime banner and stored as each
 * source map's `key`. A 160-bit hash over the chunk's *module identifiers* plus
 * its `chunk.hash`, rather than re-hashing the bundler's truncated 64-bit
 * `chunk.hash` alone (which wouldn't make it any stronger). The module-id set
 * is the chunk's source modules: different apps bundle different files, so two
 * apps can't produce the same release even if their 64-bit `chunk.hash`
 * collides — no `uniqueName` / `bid` namespace to configure — while `chunk.hash`
 * still tracks content changes within one app. Module identifiers are fixed at
 * build time and banner-independent, so the banner (build time) and the
 * collector (encode time) compute the same value for the same chunk.
 */
export function computeChunkReleaseKey(
  chunkGraph: Rspack.Compilation['chunkGraph'],
  chunk: Rspack.Chunk,
): string {
  const moduleIds: string[] = []
  for (const module of chunkGraph.getChunkModules(chunk)) {
    moduleIds.push(module.identifier())
  }
  // `getChunkModules` order is not guaranteed stable; sort so the key is
  // deterministic for a given module set.
  moduleIds.sort()
  return computeReleaseKey(chunk.name ?? '', chunk.hash ?? '', ...moduleIds)
}

export const RELEASE_DEFINE = '__DEBUG_METADATA_RELEASE__'

/**
 * Prefix tagging the runtime release as debug-metadata-origin. Reverse-
 * resolution services route releases starting with this to the debug-metadata
 * container path (vs the legacy source-map path) and strip it before
 * matching the bare release `key` stored in `debug-metadata.json`.
 */
export const RELEASE_PREFIX = 'debugmetadata:'

export function getReleaseDefine(release: string): string {
  return `var ${RELEASE_DEFINE} = ${
    JSON.stringify(RELEASE_PREFIX + release)
  };\n`
}

/**
 * Runtime snippet that registers the release with the Lynx engine. `name` is the
 * bundle's own file name without extension (e.g. `main-thread`); it is
 * substituted into the synthetic stack frame so an engine that reads the stack
 * filename (engineVersion > 2.13) reports the real file rather than a literal
 * `[name].js`. The caller injects this per output file with that file's name.
 */
export function getReleaseRuntime(name: string): string {
  return `(function () {
  'use strict';
  try {
    throw new Error(${RELEASE_DEFINE});
  } catch (e) {
    e.name = 'LynxGetSourceMapReleaseError';
    if (typeof _SetSourceMapRelease === 'function') {
      _SetSourceMapRelease(e); // original filename from engine (e.g. 'lepus.js' or 'dynamic_component_name/main-thread.js')
      e.stack = ${JSON.stringify(`    at <eval> (file://${name}.js:1:1)\n`)};
      _SetSourceMapRelease(e); // engineVersion > 2.13 reports an empty filename, so set it to the Rspeedy filename
    } else if (
      typeof lynxCoreInject !== 'undefined' &&
      typeof lynxCoreInject.tt.setSourceMapRelease === 'function'
    ) {
      lynxCoreInject.tt.setSourceMapRelease(e);
    }
  }
  if (typeof lynx !== 'undefined' &&
      typeof lynx.performance !== 'undefined' &&
      typeof lynx.performance.profileMark !== 'undefined') {
    lynx.performance.profileMark('[pluginDebugMetadata] SetSourceMapInfo', {
      args: {
        release: ${RELEASE_DEFINE},
      }
    });
  }
})();
`
}
