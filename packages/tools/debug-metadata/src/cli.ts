#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DebugMetadataAsset } from './types.js';
import { assertUiNode, remapUiTree } from './ui-remap.js';

const USAGE =
  `Usage: debug-metadata remap --ui <input.json> [--output <output.json>] [--header <name: value>]...

Reverse-resolve a Lynx UI node tree dumped by the engine. Every node that
carries a "nodeIndex" and a "debugMetadataUrl" is annotated with its source
location ("repo", "source", "line", "column"); all other fields — and nodes
that cannot be resolved — pass through unchanged.

A node's "debugMetadataUrl" may be an http(s) URL or a path relative to the
input file. Output is written to --output when given, otherwise to stdout.

Options:
  --ui, -i <input.json>           Path to the UI tree JSON dumped by the engine.
  --output, -o <output.json>      Write remapped tree here instead of stdout.
  --header, -H <name: value>      Extra HTTP header for fetching debugMetadataUrl
                                  (repeatable; e.g. -H "authorization: Bearer xxx"
                                  for endpoints that require auth).`;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

/**
 * Resolve a `debugMetadataUrl` against the input file: http(s) URLs and
 * absolute paths are kept as-is; relative paths resolve against the input
 * file's directory.
 */
function resolveRef(ref: string, baseFile: string): string {
  if (isHttpUrl(ref) || path.isAbsolute(ref)) return ref;
  return path.resolve(path.dirname(baseFile), ref);
}

/**
 * Parse a single `--header` value of the form "name: value". The first ":"
 * separates name from value (so values may contain ":"). The header name and
 * value are both trimmed; casing is otherwise preserved.
 *
 * @internal
 */
export function parseHeader(raw: string): [string, string] {
  const idx = raw.indexOf(':');
  if (idx < 0) {
    throw new Error(
      `Invalid --header value (expected "name: value"): ${raw}`,
    );
  }
  const name = raw.slice(0, idx).trim();
  const value = raw.slice(idx + 1).trim();
  if (name === '') {
    throw new Error(`Invalid --header value (empty name): ${raw}`);
  }
  return [name, value];
}

function createLoader(
  inputPath: string,
  headers: Record<string, string>,
): (debugMetadataUrl: string) => Promise<DebugMetadataAsset> {
  return async (debugMetadataUrl) => {
    const ref = resolveRef(debugMetadataUrl, inputPath);
    if (isHttpUrl(ref)) {
      const response = await fetch(ref, { headers });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${ref}: ${response.status} ${response.statusText}`,
        );
      }
      return await response.json() as DebugMetadataAsset;
    }
    return JSON.parse(await readFile(ref, 'utf8')) as DebugMetadataAsset;
  };
}

interface RemapArgs {
  ui?: string;
  output?: string;
  headers: Record<string, string>;
}

/** @internal */
export function parseRemapArgs(argv: string[]): RemapArgs {
  const args: RemapArgs = { headers: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const requireValue = (): string => {
      const value = argv[++i];
      if (value === undefined) {
        throw new Error(`Missing value for ${arg ?? ''}`);
      }
      return value;
    };
    switch (arg) {
      case '--ui':
      case '-i':
        args.ui = requireValue();
        break;
      case '--output':
      case '-o':
        args.output = requireValue();
        break;
      case '--header':
      case '-H': {
        const [name, value] = parseHeader(requireValue());
        args.headers[name] = value;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg ?? ''}`);
    }
  }
  return args;
}

async function runRemap(argv: string[]): Promise<void> {
  const args = parseRemapArgs(argv);
  if (args.ui === undefined) {
    throw new Error('Missing required --ui <input.json>');
  }

  const inputPath = path.resolve(process.cwd(), args.ui);
  const root: unknown = JSON.parse(await readFile(inputPath, 'utf8'));
  assertUiNode(root);

  const remapped = await remapUiTree(
    root,
    createLoader(inputPath, args.headers),
  );
  const serialized = `${JSON.stringify(remapped, null, 2)}\n`;

  if (args.output === undefined) {
    process.stdout.write(serialized);
  } else {
    await writeFile(path.resolve(process.cwd(), args.output), serialized);
  }
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case 'remap':
      await runRemap(rest);
      break;
    case undefined:
    case '--help':
    case '-h':
      process.stdout.write(`${USAGE}\n`);
      break;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}\n`);
      process.exitCode = 1;
  }
}

// Only run main() when this file is invoked as the CLI entry point — avoids
// kicking off argv parsing when imported from tests. Use fileURLToPath +
// path.resolve so the comparison handles Windows separators, drive-letter
// casing, and percent-encoded characters in the file:// URL.
if (
  process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error
      ? (error.stack ?? error.message)
      : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
