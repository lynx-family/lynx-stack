// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  Artifact,
  BytecodeDebugInfoSource,
  DebugMetadataAsset,
  SourceMapDebugSource,
} from './types.js';

/**
 * Find an {@link Artifact} by `filename` (e.g. `main-thread.js`,
 * `background.fd311de1.js`, `main.css`).
 *
 * @public
 */
export function findArtifact(
  metadata: DebugMetadataAsset,
  query: { filename: string },
): Artifact | undefined {
  return metadata.artifacts.find(a => a.filename === query.filename);
}

/**
 * Find a `source-map` {@link SourceMapDebugSource} by `path`,
 * `filename`, or `key`. At least one of the three should be set;
 * every comparison is an exact equality on the field of the same
 * name on {@link SourceMapDebugSource}.
 *
 * @public
 */
export function findSourceMap(
  metadata: DebugMetadataAsset,
  query: { path?: string; filename?: string; key?: string },
): SourceMapDebugSource | undefined {
  if (
    query.path === undefined
    && query.filename === undefined
    && query.key === undefined
  ) {
    return undefined;
  }
  for (const artifact of metadata.artifacts) {
    for (const ds of artifact.debugSources) {
      if (ds.kind !== 'source-map') continue;
      if (query.path !== undefined && ds.path !== query.path) continue;
      if (query.filename !== undefined && ds.filename !== query.filename) {
        continue;
      }
      if (query.key !== undefined && ds.key !== query.key) continue;
      return ds;
    }
  }
  return undefined;
}

/**
 * Find a `bytecode-debug-info` source attached to the artifact named
 * `filename`.
 *
 * @public
 */
export function findBytecodeDebugInfo(
  metadata: DebugMetadataAsset,
  query: { filename: string },
): BytecodeDebugInfoSource | undefined {
  const artifact = findArtifact(metadata, query);
  if (!artifact) return undefined;
  return artifact.debugSources.find(
    (ds): ds is BytecodeDebugInfoSource => ds.kind === 'bytecode-debug-info',
  );
}

/**
 * Parameters every resolver receives. Resolvers pick the keys they need.
 *
 * @public
 */
export interface QueryParams {
  /** Bundler-relative asset path (e.g. `.rspeedy/main/main-thread.js.map`). */
  path?: string;
  /** Asset basename (e.g. `main-thread.js`). */
  filename?: string;
  /** Chunk hash / release identifier. */
  key?: string;
}

/**
 * Describes how to look up one queryable field and (optionally) which
 * sub-field of the matched value to return to callers.
 *
 * `resolve` runs the lookup. `payload` is an optional unwrapper: for a
 * `source-map` query, the resolver returns the full
 * {@link SourceMapDebugSource} wrapper but HTTP consumers typically want
 * the raw Source Map v3 JSON — `payload: sm => sm.map` performs the
 * unwrap.
 *
 * @public
 */
export interface FieldResolver<T = unknown> {
  resolve(metadata: DebugMetadataAsset, params: QueryParams): T | undefined;
  payload?(value: T): unknown;
}

/**
 * Field name → resolver. **HTTP layers read this directly.** Mutations
 * are honoured by the next request — the export is a live `Map` so
 * plugins can register their own fields at startup.
 *
 * Adding a new field is a one-line `FIELDS.set('your-name', { ... })`.
 *
 * @public
 */
export const FIELDS: Map<string, FieldResolver> = new Map();

FIELDS.set('source-map', {
  resolve: (m, p) => findSourceMap(m, p),
  payload: (sm) => (sm as SourceMapDebugSource).map,
});

FIELDS.set('bytecode-debug-info', {
  resolve: (m, p) =>
    p.filename ? findBytecodeDebugInfo(m, { filename: p.filename }) : undefined,
  payload: (b) => (b as BytecodeDebugInfoSource).debugInfo,
});

FIELDS.set('artifact', {
  resolve: (m, p) =>
    p.filename ? findArtifact(m, { filename: p.filename }) : undefined,
});

FIELDS.set('artifacts', { resolve: (m) => m.artifacts });
FIELDS.set('ui-source-map', { resolve: (m) => m.uiSourceMap });
FIELDS.set('meta', { resolve: (m) => m.meta });
FIELDS.set('git', { resolve: (m) => m.meta.git });
FIELDS.set('rspeedy', { resolve: (m) => m.meta.rspeedy });

/**
 * Result of {@link resolveField}.
 *
 * @public
 */
export interface ResolveResult {
  /** `true` when the resolver matched; `false` when the field is known
   * but no value matched (HTTP layer → 404). */
  found: boolean;
  /** Present only when `found`. The value to JSON-serialize back to the
   * client (already unwrapped via `FieldResolver.payload`). */
  payload?: unknown;
}

/**
 * Resolve a `?field=…` query against parsed metadata.
 *
 * - Returns `undefined` when the field is not registered — HTTP layer
 *   responds `400 invalid_field` and lists `knownFields()`.
 * - Returns `{found: false}` when the field is valid but no value
 *   matched — HTTP layer responds `404`.
 * - Returns `{found: true, payload}` when matched. `payload` is the
 *   already-unwrapped value (resolver's `payload` hook applied).
 *
 * @public
 */
export function resolveField(
  metadata: DebugMetadataAsset,
  field: string,
  params: QueryParams = {},
): ResolveResult | undefined {
  const resolver = FIELDS.get(field);
  if (!resolver) return undefined;
  const matched = resolver.resolve(metadata, params);
  if (matched === undefined) return { found: false };
  const payload = resolver.payload ? resolver.payload(matched) : matched;
  return { found: true, payload };
}

/**
 * All currently-registered field names. Use for `400 invalid_field`
 * responses so the listing auto-updates when new fields are registered.
 *
 * @public
 */
export function knownFields(): string[] {
  return [...FIELDS.keys()];
}
