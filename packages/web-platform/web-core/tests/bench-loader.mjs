// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Module-resolution hook for running the web-core benchmarks on plain Node.
//
// The `ts/` source imports its TypeScript siblings via `.js` specifiers (e.g.
// `import { wasmInstance } from '../../wasm.js'` resolving to `wasm.ts`). Node's
// native type-stripping does not rewrite `.js` -> `.ts`, so this resolve-only
// hook does it: for a relative `.js` specifier whose `.js` file does not exist
// but a `.ts` sibling does, resolve the `.ts` instead and let Node strip the
// types. It deliberately touches nothing in `node_modules`.
import { existsSync } from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, next) {
  if (
    (specifier.startsWith('./') || specifier.startsWith('../'))
    && specifier.endsWith('.js')
  ) {
    try {
      const jsUrl = new URL(specifier, context.parentURL);
      if (!existsSync(fileURLToPath(jsUrl))) {
        const tsSpecifier = specifier.slice(0, -3) + '.ts';
        const tsUrl = new URL(tsSpecifier, context.parentURL);
        if (existsSync(fileURLToPath(tsUrl))) {
          return next(tsSpecifier, context);
        }
      }
    } catch {
      // fall through to the default resolver
    }
  }
  return next(specifier, context);
}

// When imported via `node --import`, register this module as a loader for the
// worker resolving subsequent imports.
register(import.meta.url, import.meta.url);
