// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentType } from '@lynx-js/react';

import type { GenericComponentProps } from '../store/types.js';

/**
 * JSON Schema fragment describing a component's props. Produced at build time
 * by `@lynx-js/a2ui-catalog-extractor` from the component's TypeScript
 * interface marked with `@a2uiCatalog <Name>`. Optional at runtime — entries
 * that ship without a schema serialize to just `{ name }`.
 */
export type CatalogSchema = Record<string, unknown>;

/**
 * The shape produced by the extractor as `dist/catalog/<Name>/catalog.json`.
 * The single top-level key is the component's protocol name; the value is
 * its schema. Importing the JSON gives you both, in one declaration.
 */
export type CatalogManifest = Record<string, CatalogSchema>;

/**
 * Loose component type — entries receive runtime-shaped props from the
 * protocol stream, so we don't enforce per-component prop typing here.
 */
export type CatalogComponent = ComponentType<GenericComponentProps>;

/**
 * What the developer passes into `defineCatalog`. Three forms:
 *
 *  - **Bare component** — name is read from `displayName ?? name`. Useful
 *    for renderer-only consumers who don't need to announce schemas to the
 *    agent.
 *  - **`[component, manifest]` tuple** — name and schema are read from the
 *    manifest. Use this when you want `serializeCatalog(...)` to include a
 *    schema for this component in the agent handshake.
 *  - **`ResolvedCatalogEntry`** — pass-through for already-resolved entries
 *    (e.g. the output of `mergeCatalogs(...)` or another `defineCatalog`).
 */
export type CatalogInput =
  | CatalogComponent
  | readonly [CatalogComponent, CatalogManifest]
  | ResolvedCatalogEntry;

/**
 * A resolved catalog entry. Internal representation; consumers don't usually
 * construct these directly — they pass `CatalogInput`s to `defineCatalog`.
 */
export interface ResolvedCatalogEntry {
  name: string;
  component: CatalogComponent;
  schema?: CatalogSchema;
}

export type Catalog = readonly ResolvedCatalogEntry[];

/** The serialized payload sent to the agent during channel handshake. */
export interface SerializedCatalog {
  version: '0.9';
  components: Array<{ name: string; schema?: CatalogSchema }>;
}

function isResolvedEntry(input: CatalogInput): input is ResolvedCatalogEntry {
  return typeof input === 'object'
    && input !== null
    && !Array.isArray(input)
    && 'component' in input
    && 'name' in input;
}

function isTuple(
  input: CatalogInput,
): input is readonly [CatalogComponent, CatalogManifest] {
  return Array.isArray(input);
}

function deriveBareName(component: CatalogComponent): string {
  const name = (component as { displayName?: string }).displayName
    ?? (component as { name?: string }).name;
  if (!name) {
    throw new Error(
      '[a2ui] Cannot add a component to the catalog: no displayName or '
        + 'function name. This typically happens when the bundler '
        + 'minifies function names. Set `Foo.displayName = "Foo"` after '
        + 'the component declaration (the string literal survives '
        + 'minification), or pair it with its `catalog.json` manifest as '
        + '`[Foo, fooManifest]`.',
    );
  }
  return name;
}

function resolveInput(input: CatalogInput): ResolvedCatalogEntry {
  if (isResolvedEntry(input)) return input;
  if (isTuple(input)) {
    const [component, manifest] = input;
    const keys = Object.keys(manifest);
    if (keys.length === 0) {
      throw new Error(
        '[a2ui] Empty manifest passed to defineCatalog; expected '
          + '`{ <ComponentName>: schema }`.',
      );
    }
    const name = keys[0]!;
    const entry: ResolvedCatalogEntry = { name, component };
    const schema = manifest[name];
    if (schema !== undefined) entry.schema = schema;
    return entry;
  }
  return { name: deriveBareName(input), component: input };
}

/**
 * Build a catalog from a list of components and/or `[component, manifest]`
 * pairs. The protocol name comes from the manifest key (tuple form) or
 * from `displayName ?? name` (bare component form). Duplicate names are
 * rejected.
 *
 * @example
 * import { Text, Button } from '@lynx-js/a2ui-reactlynx';
 * import textManifest from '@lynx-js/a2ui-reactlynx/catalog/Text/catalog.json'
 *   with { type: 'json' };
 *
 * const catalog = defineCatalog([
 *   [Text, textManifest],   // renderer + handshake metadata
 *   Button,                  // renderer-only
 * ]);
 */
export function defineCatalog(inputs: readonly CatalogInput[]): Catalog {
  const entries: ResolvedCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const entry = resolveInput(input);
    if (seen.has(entry.name)) {
      throw new Error(
        `[a2ui] Duplicate component name in catalog: "${entry.name}". `
          + `Use mergeCatalogs() if you intend to override.`,
      );
    }
    seen.add(entry.name);
    entries.push(entry);
  }
  return entries;
}

/**
 * Merge multiple catalogs. Last write wins on duplicate names — useful when
 * a page-level catalog overrides a brand-level one which overrides built-ins.
 */
export function mergeCatalogs(...catalogs: Catalog[]): Catalog {
  const map = new Map<string, ResolvedCatalogEntry>();
  for (const cat of catalogs) {
    for (const entry of cat) map.set(entry.name, entry);
  }
  return Array.from(map.values());
}

/**
 * Build a name → component lookup map from a catalog. The renderer uses
 * this to resolve `{ component: 'Text', ... }` from the protocol stream.
 */
export function resolveCatalog(
  catalog: Catalog,
): ReadonlyMap<string, CatalogComponent> {
  const map = new Map<string, CatalogComponent>();
  for (const entry of catalog) map.set(entry.name, entry.component);
  return map;
}

/**
 * Produce the JSON manifest the client should announce to the agent during
 * channel handshake. Entries without an attached schema serialize to
 * `{ name }` only — useful for letting the agent at least know what's
 * renderable.
 */
export function serializeCatalog(catalog: Catalog): SerializedCatalog {
  const components: Array<{ name: string; schema?: CatalogSchema }> = [];
  for (const entry of catalog) {
    const out: { name: string; schema?: CatalogSchema } = { name: entry.name };
    if (entry.schema !== undefined) out.schema = entry.schema;
    components.push(out);
  }
  return { version: '0.9', components };
}
