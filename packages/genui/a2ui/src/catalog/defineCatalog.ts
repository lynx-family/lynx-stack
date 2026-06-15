// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentType } from '@lynx-js/react';

import { functionRegistry } from '../store/FunctionRegistry.js';
import type {
  FunctionDefinition,
  FunctionImpl,
} from '../store/FunctionRegistry.js';
import type { GenericComponentProps } from '../store/types.js';

/**
 * JSON Schema fragment describing a component's props. Produced at build time
 * by `@lynx-js/genui/a2ui-catalog-extractor` from the component's TypeScript
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
 * The structured function definition that flows from the extractor (or the
 * upstream basic-catalog manifests) into the catalog and out to the agent
 * during the handshake. Aliased onto the store's `FunctionDefinition` so
 * `functionRegistry.register({ definition })` accepts catalog entries
 * directly without re-shaping.
 */
export type CatalogFunctionDefinition = FunctionDefinition;

export type FunctionManifest = Record<string, CatalogFunctionDefinition>;

/**
 * A function entry — pair an impl with its name, plus an optional manifest
 * so the handshake can announce the schema to the agent.
 */
export interface CatalogFunctionEntry {
  kind: 'function';
  name: string;
  impl: FunctionImpl;
  definition?: CatalogFunctionDefinition;
}

/**
 * Build a function entry for `defineCatalog`. Either pair the impl with the
 * extracted manifest, or pass just the impl (the registry still routes
 * calls; the agent just won't see the parameter schema).
 *
 * @example
 * const requiredEntry = defineFunction(required, requiredManifest);
 * const catalog = defineCatalog([Text, Button, requiredEntry]);
 */
export function defineFunction(
  impl: FunctionImpl,
  manifest?: FunctionManifest,
): CatalogFunctionEntry {
  if (manifest) {
    const keys = Object.keys(manifest);
    if (keys.length === 0) {
      throw new Error(
        '[a2ui] Empty manifest passed to defineFunction; expected '
          + '`{ <functionName>: definition }`.',
      );
    }
    const name = keys[0]!;
    const definition = manifest[name]!;
    return {
      kind: 'function',
      name,
      impl,
      definition,
    };
  }
  const name = (impl as { displayName?: string; name?: string }).displayName
    ?? (impl as { name?: string }).name;
  if (!name) {
    throw new Error(
      '[a2ui] Cannot add a function to the catalog: no name available. '
        + 'Pair it with its manifest as `defineFunction(impl, manifest)`, '
        + 'or set `impl.displayName = "..."`.',
    );
  }
  return { kind: 'function', name, impl };
}

/**
 * What the developer passes into `defineCatalog`. Components and function
 * entries can be intermixed.
 */
export type CatalogInput =
  | CatalogComponent
  | readonly [CatalogComponent, CatalogManifest]
  | ResolvedCatalogEntry
  | CatalogFunctionEntry;

/**
 * A resolved catalog entry. Internal representation; consumers don't usually
 * construct these directly — they pass `CatalogInput`s to `defineCatalog`.
 */
export interface ResolvedCatalogEntry {
  name: string;
  component: CatalogComponent;
  schema?: CatalogSchema;
}

/**
 * Runtime catalog consumed by the renderer and serialized for the agent
 * handshake.
 */
export interface Catalog {
  readonly components: readonly ResolvedCatalogEntry[];
  readonly functions: readonly CatalogFunctionEntry[];
}

/** The serialized payload sent to the agent during channel handshake. */
export interface SerializedCatalog {
  version: '0.9';
  components: Array<{ name: string; schema?: CatalogSchema }>;
  functions?: CatalogFunctionDefinition[];
}

function isFunctionEntry(input: CatalogInput): input is CatalogFunctionEntry {
  return typeof input === 'object'
    && input !== null
    && !Array.isArray(input)
    && (input as CatalogFunctionEntry).kind === 'function';
}

function isResolvedEntry(input: CatalogInput): input is ResolvedCatalogEntry {
  return typeof input === 'object'
    && input !== null
    && !Array.isArray(input)
    && 'component' in input
    && 'name' in input
    && !isFunctionEntry(input);
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

function resolveComponentInput(input: CatalogInput): ResolvedCatalogEntry {
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
    const entry: ResolvedCatalogEntry = { name, component: component };
    const schema = manifest[name];
    if (schema !== undefined) entry.schema = schema;
    return entry;
  }
  return {
    name: deriveBareName(input as CatalogComponent),
    component: input as CatalogComponent,
  };
}

/**
 * Build a catalog from a list of components, `[component, manifest]` pairs,
 * and/or function entries. Duplicate names within the same kind are rejected.
 * Function entries register their impls into `functionRegistry` immediately,
 * so any `executeFunctionCall` after `defineCatalog` can route to them.
 *
 * @example
 * import { Text, Button } from '@lynx-js/genui/a2ui';
 * import { defineCatalog, defineFunction } from '@lynx-js/genui/a2ui';
 * import { required } from '@lynx-js/genui/a2ui/functions';
 * import textManifest from '@lynx-js/genui/a2ui/catalog/Text/catalog.json'
 *   with { type: 'json' };
 *
 * const catalog = defineCatalog([
 *   [Text, textManifest],
 *   Button,
 *   defineFunction(required),
 * ]);
 */
export function defineCatalog(inputs: readonly CatalogInput[]): Catalog {
  const components: ResolvedCatalogEntry[] = [];
  const functions: CatalogFunctionEntry[] = [];
  const seenComponents = new Set<string>();
  const seenFunctions = new Set<string>();

  for (const input of inputs) {
    if (isFunctionEntry(input)) {
      if (seenFunctions.has(input.name)) {
        throw new Error(
          `[a2ui] Duplicate function name in catalog: "${input.name}". `
            + `Use mergeCatalogs() if you intend to override.`,
        );
      }
      seenFunctions.add(input.name);
      functions.push(input);
      functionRegistry.register({
        name: input.name,
        impl: input.impl,
        ...(input.definition ? { definition: input.definition } : {}),
      });
      continue;
    }
    const entry = resolveComponentInput(input);
    if (seenComponents.has(entry.name)) {
      throw new Error(
        `[a2ui] Duplicate component name in catalog: "${entry.name}". `
          + `Use mergeCatalogs() if you intend to override.`,
      );
    }
    seenComponents.add(entry.name);
    components.push(entry);
  }

  return { components, functions };
}

/**
 * Merge multiple catalogs. Last write wins on duplicate names — useful when
 * a page-level catalog overrides a brand-level one which overrides built-ins.
 */
export function mergeCatalogs(...catalogs: Catalog[]): Catalog {
  const componentMap = new Map<string, ResolvedCatalogEntry>();
  const functionMap = new Map<string, CatalogFunctionEntry>();
  for (const cat of catalogs) {
    for (const entry of cat.components) componentMap.set(entry.name, entry);
    for (const fn of cat.functions) functionMap.set(fn.name, fn);
  }
  // Re-register so the registry tracks the merged set.
  for (const fn of functionMap.values()) {
    functionRegistry.register({
      name: fn.name,
      impl: fn.impl,
      ...(fn.definition ? { definition: fn.definition } : {}),
    });
  }
  return {
    components: Array.from(componentMap.values()),
    functions: Array.from(functionMap.values()),
  };
}

/**
 * Build a name → component lookup map from a catalog. The renderer uses
 * this to resolve `{ component: 'Text', ... }` from the protocol stream.
 */
export function resolveCatalog(
  catalog: Catalog,
): ReadonlyMap<string, CatalogComponent> {
  const map = new Map<string, CatalogComponent>();
  for (const entry of catalog.components) map.set(entry.name, entry.component);
  return map;
}

/**
 * Produce the JSON manifest the client should announce to the agent during
 * channel handshake. Component entries without an attached schema serialize
 * to `{ name }` only — useful for letting the agent at least know what's
 * renderable. Function entries serialize with their parameter schema when
 * available.
 */
export function serializeCatalog(catalog: Catalog): SerializedCatalog {
  const components: Array<{ name: string; schema?: CatalogSchema }> = [];
  for (const entry of catalog.components) {
    const out: { name: string; schema?: CatalogSchema } = { name: entry.name };
    if (entry.schema !== undefined) out.schema = entry.schema;
    components.push(out);
  }
  const serialized: SerializedCatalog = { version: '0.9', components };
  const functions = catalog.functions
    .filter(fn => fn.definition !== undefined)
    .map(fn => fn.definition!);
  if (functions.length > 0) serialized.functions = functions;
  return serialized;
}
