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
 * {@link DebugMetadataAsset}; for field-by-field lookups (`?field=…`
 * style queries), use the `FIELDS` registry and `resolveField`
 * dispatcher.
 */

export type {
  Artifact,
  BytecodeDebugInfoSource,
  DebugMetadataAsset,
  DebugSource,
  GitMetadata,
  LepusNGDebugInfo,
  LepusNGDebugInfoBody,
  LepusNGFunctionInfo,
  RspeedyMeta,
  SourceMap,
  SourceMapDebugSource,
  SourceMapSection,
  UiSourceMapData,
} from './types.js';

export {
  FIELDS,
  findArtifact,
  findBytecodeDebugInfo,
  findSourceMap,
  knownFields,
  resolveField,
} from './resolve.js';
export type { FieldResolver, QueryParams, ResolveResult } from './resolve.js';

export { UI_SOURCE_MAP_RECORDS_BUILD_INFO } from './ui-source-map.js';
export type { UiSourceMapRecord } from './ui-source-map.js';
