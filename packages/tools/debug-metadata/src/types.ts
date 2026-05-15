// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Schema types for the Lynx `debug-metadata.json` format.
 *
 * The shape captured here reflects what `@lynx-js/debug-metadata-rsbuild-plugin`
 * currently emits. The format is intended to grow over time — future entries
 * such as JS / bytecode source maps and per-artifact debug information will be
 * added as the emitter implements them. Consumers should treat any field they
 * do not recognise as opaque rather than rejecting the payload.
 */

/**
 * Compact UI source map payload — the `uiSourceMap` field of
 * {@link DebugMetadataAsset}.
 *
 * @public
 */
export interface UiSourceMapData {
  version: 1;
  sources: string[];
  mappings: [number, number, number][];
  uiMaps: number[];
}

/**
 * Full `debug-metadata.json` payload emitted per Lynx template entry.
 *
 * @public
 */
export interface DebugMetadataAsset {
  /** Compact UI source map for the entry's runtime UI tree. */
  uiSourceMap: UiSourceMapData;
  /**
   * Free-form bag for build-time / context info. Producers may attach
   * namespaced keys (e.g. `meta.git`, `meta.rspeedy`) without breaking
   * consumers.
   */
  meta: Record<string, unknown>;
}
