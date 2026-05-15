// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * Schema types for the Lynx `debug-metadata.json` format.
 *
 * Zero runtime dependencies. Safe to consume from any Node.js context —
 * rsbuild plugins, dev-server middleware, reverse-symbolication services,
 * CLI tools, etc. Read the JSON with `JSON.parse` and cast to
 * {@link DebugMetadataAsset}; no runtime helpers are provided yet because
 * the schema has nothing to validate beyond what the type already states.
 */

export type { DebugMetadataAsset, UiSourceMapData } from './types.js';
