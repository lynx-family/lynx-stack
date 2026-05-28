// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { DebugMetadataAsset, UiSourceMapData } from './types.js';

/**
 * Source location recovered for a single UI node, in the shape the
 * reverse-resolved tree gains alongside its original fields.
 *
 * @public
 */
export interface UiSourceLocation {
  /** `owner/repo` derived from the build's git remote, or `null`. */
  repo: string | null;
  /** Authored source path (relative to the project root), or `null`. */
  source: string | null;
  /** 1-based source line. */
  line: number;
  /** 1-based source column. */
  column: number;
}

/**
 * One UI node of the tree the Lynx engine dumps — the input to
 * {@link remapUiTree}. Three fields are read: `nodeIndex` and
 * `debugMetadataUrl` drive reverse-resolution, and `children` is walked
 * recursively. All three are optional because the engine emits nodes that
 * carry no source mapping (e.g. raw-text nodes have no `nodeIndex`); such
 * nodes pass through untouched. Every other field is opaque.
 *
 * @public
 */
export interface UiNode {
  /** Compile-time node identity, looked up in the UI source map. */
  nodeIndex?: number;
  /** URL/path of the `debug-metadata.json` covering this node. */
  debugMetadataUrl?: string;
  /** Child nodes, walked recursively. */
  children?: UiNode[];
  [field: string]: unknown;
}

/**
 * A {@link UiNode} after reverse-resolution. Nodes whose `nodeIndex` is
 * known to their `debugMetadataUrl`'s UI source map gain the
 * {@link UiSourceLocation} fields; all others are returned verbatim.
 *
 * @public
 */
export interface RemappedUiNode extends UiNode {
  children?: RemappedUiNode[];
  repo?: string | null;
  source?: string | null;
  line?: number;
  column?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Assert that a parsed value is a {@link UiNode} tree. Use it at trust
 * boundaries — e.g. right after `JSON.parse`-ing an engine dump — so
 * malformed input fails fast with a located error (`$.children[1]`-style
 * path) instead of crashing deep inside resolution.
 *
 * `nodeIndex`, `debugMetadataUrl` and `children` are all optional (the
 * engine emits nodes with no source mapping, such as raw text); they are
 * only rejected when present with the wrong type. A non-object, or a
 * `children` that is not an array, is always rejected.
 *
 * @public
 */
export function assertUiNode(
  value: unknown,
  path = '$',
): asserts value is UiNode {
  if (!isRecord(value)) {
    throw new Error(`Invalid UI node at ${path}: expected an object`);
  }
  if (
    value['nodeIndex'] !== undefined && typeof value['nodeIndex'] !== 'number'
  ) {
    throw new Error(`Invalid UI node at ${path}: "nodeIndex" must be a number`);
  }
  if (
    value['debugMetadataUrl'] !== undefined
    && typeof value['debugMetadataUrl'] !== 'string'
  ) {
    throw new Error(
      `Invalid UI node at ${path}: "debugMetadataUrl" must be a string`,
    );
  }
  const children = value['children'];
  if (children !== undefined) {
    if (!Array.isArray(children)) {
      throw new Error(
        `Invalid UI node at ${path}: "children" must be an array`,
      );
    }
    children.forEach((child, i) => {
      assertUiNode(child, `${path}.children[${i}]`);
    });
  }
}

/**
 * Runtime check that a parsed value matches {@link UiSourceMapData}'s
 * load-bearing shape — an object with `sources`, `mappings` and `uiMaps`
 * arrays. Guards against `debugMetadataUrl`s that resolve to JSON of a
 * different (or older) format.
 *
 * @public
 */
export function isUiSourceMapData(value: unknown): value is UiSourceMapData {
  return isRecord(value)
    && Array.isArray(value['sources'])
    && Array.isArray(value['mappings'])
    && Array.isArray(value['uiMaps']);
}

/**
 * Build a `nodeIndex -> {source, line, column}` lookup from a
 * {@link UiSourceMapData}. The payload is column-oriented: `uiMaps[i]`
 * is the nodeIndex, and the matching `mappings[i]` entry holds
 * `[sourceIndex, line, column]`, with `sourceIndex` indexing `sources`.
 *
 * @public
 */
export function buildUiSourceMapLookup(
  uiSourceMap: UiSourceMapData,
): Map<number, Omit<UiSourceLocation, 'repo'>> {
  const { sources, mappings, uiMaps } = uiSourceMap;
  const lookup = new Map<number, Omit<UiSourceLocation, 'repo'>>();
  for (let i = 0; i < uiMaps.length; i++) {
    const nodeIndex = uiMaps[i];
    const mapping = mappings[i];
    if (nodeIndex === undefined || mapping === undefined) continue;
    const [sourceIndex, line, column] = mapping;
    lookup.set(nodeIndex, {
      source: sources[sourceIndex] ?? null,
      line,
      column,
    });
  }
  return lookup;
}

/**
 * Normalize a git remote URL (SSH or HTTP form) to an `owner/repo`
 * identifier, dropping any trailing `.git`. Returns `null` for empty
 * input and the original string when it matches no known form.
 *
 * @public
 */
export function normalizeRepo(
  remoteUrl: string | null | undefined,
): string | null {
  if (typeof remoteUrl !== 'string' || remoteUrl.length === 0) {
    return null;
  }
  const ssh = remoteUrl.match(/^git@[^:]+:(.+?)(?:\.git)?$/)?.[1];
  if (ssh !== undefined) return ssh;
  const http = remoteUrl.match(/^https?:\/\/[^/]+\/(.+?)(?:\.git)?$/)?.[1];
  if (http !== undefined) return http;
  return remoteUrl;
}

/**
 * Loads the {@link DebugMetadataAsset} a node's `debugMetadataUrl` points
 * at. Supplied by the caller so the core stays free of I/O (the CLI wires
 * up `fetch` / `fs`); only called once per distinct URL.
 *
 * @public
 */
export type DebugMetadataLoader = (
  debugMetadataUrl: string,
) => Promise<DebugMetadataAsset>;

/**
 * Reverse-resolve a UI node tree dumped by the Lynx engine.
 *
 * Every node carrying both a `nodeIndex` and a `debugMetadataUrl` whose
 * `uiSourceMap` knows that index is annotated with {@link UiSourceLocation}
 * fields (`repo`, `source`, `line`, `column`). All other fields — and nodes
 * that cannot be resolved — pass through verbatim. The input is not
 * mutated; a new tree is returned.
 *
 * @public
 */
export async function remapUiTree(
  root: UiNode,
  loadMetadata: DebugMetadataLoader,
): Promise<RemappedUiNode> {
  interface Resolved {
    lookup: Map<number, Omit<UiSourceLocation, 'repo'>>;
    repo: string | null;
  }
  const cache = new Map<string, Promise<Resolved>>();

  function resolve(debugMetadataUrl: string): Promise<Resolved> {
    let pending = cache.get(debugMetadataUrl);
    if (pending === undefined) {
      pending = loadMetadata(debugMetadataUrl).then((loaded) => {
        const metadata: unknown = loaded;
        if (
          !isRecord(metadata) || !isUiSourceMapData(metadata['uiSourceMap'])
        ) {
          throw new Error(
            `Invalid debug-metadata loaded from "${debugMetadataUrl}": `
              + 'expected a "uiSourceMap" object with array fields '
              + '"sources", "mappings" and "uiMaps". Make sure the URL '
              + 'points to a debug-metadata.json emitted by the Lynx build.',
          );
        }
        const meta = metadata['meta'];
        const git: unknown = isRecord(meta) ? meta['git'] : undefined;
        const remoteUrl: unknown = isRecord(git) ? git['remoteUrl'] : undefined;
        return {
          lookup: buildUiSourceMapLookup(metadata['uiSourceMap']),
          repo: normalizeRepo(
            typeof remoteUrl === 'string' ? remoteUrl : null,
          ),
        };
      });
      cache.set(debugMetadataUrl, pending);
    }
    return pending;
  }

  async function remapNode(node: UiNode): Promise<RemappedUiNode> {
    const out: RemappedUiNode = { ...node };

    if (Array.isArray(node.children)) {
      out.children = await Promise.all(node.children.map(remapNode));
    }

    if (
      typeof node.debugMetadataUrl === 'string'
      && node.debugMetadataUrl.length > 0
      && typeof node.nodeIndex === 'number'
    ) {
      const { lookup, repo } = await resolve(node.debugMetadataUrl);
      const location = lookup.get(node.nodeIndex);
      if (location !== undefined) {
        out.repo = repo;
        out.source = location.source;
        out.line = location.line;
        out.column = location.column;
      }
    }

    return out;
  }

  return remapNode(root);
}
