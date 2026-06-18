// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// In-process evaluator for compiled ET fixtures.
//
// The ET fixtures are compiled at runtime by `transformReactLynx`, producing ESM
// that imports a small, fixed set of `@lynx-js/react/*` runtime entry points and
// exports `App` (plus optional `mainProps`/`backgroundProps`). An earlier
// harness wrote this code to a temp `.js` file and `await import()`ed it. Under
// rstest that escapes the rspack bundler into Node's native ESM loader, which
// cannot resolve the bare `@lynx-js/react/*` specifiers (they alias to TypeScript
// `src/**` files) nor the `.tsx` source. That is the root cause of the
// `Unknown file extension ".tsx"` / `Cannot find package '@lynx-js/react'`
// failures.
//
// Instead, we evaluate the compiled module in-process and resolve its imports to
// the SAME runtime module instances the rest of the test already uses (rspack
// bundles these static imports through the config aliases). This keeps shared
// runtime state (template registry, element-PAPI, etc.) consistent, which the
// temp-file `import()` could not guarantee anyway.

import * as ReactLynx from '@lynx-js/react';
import * as ReactLynxInternal from '@lynx-js/react/internal';
import * as ElementTemplate from '@lynx-js/react/element-template';
import * as ElementTemplateInternal from '@lynx-js/react/element-template/internal';
import * as JsxRuntime from '@lynx-js/react/jsx-runtime';

const MODULE_REGISTRY: Record<string, Record<string, unknown>> = {
  '@lynx-js/react': ReactLynx as Record<string, unknown>,
  '@lynx-js/react/internal': ReactLynxInternal as Record<string, unknown>,
  '@lynx-js/react/element-template': ElementTemplate as Record<string, unknown>,
  '@lynx-js/react/element-template/internal': ElementTemplateInternal as Record<string, unknown>,
  '@lynx-js/react/jsx-runtime': JsxRuntime as Record<string, unknown>,
  // The compiler emits `react/jsx-runtime`; runners normalize it to the
  // `@lynx-js/react` form, but accept both to be safe.
  'react/jsx-runtime': JsxRuntime as Record<string, unknown>,
};

function requireModule(specifier: string): Record<string, unknown> {
  const mod = MODULE_REGISTRY[specifier];
  if (!mod) {
    throw new Error(
      `compiledModuleEval: cannot resolve import "${specifier}". `
        + `Only the @lynx-js/react runtime entry points are available in-process.`,
    );
  }
  return mod;
}

const IMPORT_RE = /^\s*import\s+(.+?)\s+from\s+["']([^"']+)["']\s*;?\s*$/;
const SIDE_EFFECT_IMPORT_RE = /^\s*import\s+["']([^"']+)["']\s*;?\s*$/;

/**
 * Rewrite the closed set of ESM forms the SWC compiler emits for ET fixtures
 * into CommonJS, so the code can be evaluated with `new Function`.
 */
function transpileEsmToCjs(code: string): string {
  const importStatements: string[] = [];
  const exportAssignments: string[] = [];

  // Transpile import statements line-by-line (they are always single-line in the
  // SWC compiler output) and strip them from the body.
  let body = code
    .split('\n')
    .filter((line) => {
      // `import "x.css?cssId=1";` side-effect imports: drop (no runtime here).
      if (SIDE_EFFECT_IMPORT_RE.test(line)) {
        return false;
      }
      const importMatch = IMPORT_RE.exec(line);
      if (importMatch) {
        importStatements.push(transpileImport(importMatch[1]!.trim(), importMatch[2]!));
        return false;
      }
      return true;
    })
    .join('\n');

  // Re-export a local binding as a LIVE binding. ESM exports are live: a fixture
  // that does `export let x` and later reassigns `x` (e.g. `App` setting
  // `lastRenderPromise = runOnMainThread(...)()` during render) must have the new
  // value observable through the module's exports. A one-time `__exports.x = x`
  // snapshots the initial (often `undefined`) value, so use a getter that reads
  // the current local binding — matching what native `import()` gave under vitest.
  const liveBinding = (exportName: string, localName: string): string =>
    `Object.defineProperty(__exports, ${JSON.stringify(exportName)}, `
    + `{ get: () => ${localName}, enumerable: true, configurable: true });`;

  // Strip the leading `export ` keyword from declarations IN PLACE (so multi-line
  // function/class/const declarations stay intact) and record the names to
  // re-export at the end of the module.
  body = body.replace(
    /^export\s+(default\s+)?(async\s+)?(function\*?|class|const|let|var)\s+([A-Za-z0-9_$]+)/gm,
    (_match, isDefault, asyncKw = '', kind, name) => {
      exportAssignments.push(liveBinding(name, name));
      if (isDefault) {
        exportAssignments.push(liveBinding('default', name));
      }
      return `${asyncKw}${kind} ${name}`;
    },
  );

  // `export { a, b as c };`
  body = body.replace(/^export\s+\{([^}]*)\}\s*;?\s*$/gm, (_match, names: string) => {
    for (const part of names.split(',').map((p) => p.trim()).filter(Boolean)) {
      const asMatch = /^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/.exec(part);
      if (asMatch) {
        exportAssignments.push(liveBinding(asMatch[2]!, asMatch[1]!));
      } else {
        exportAssignments.push(liveBinding(part, part));
      }
    }
    return '';
  });

  // `export default <expr>;` (when not a named declaration handled above)
  body = body.replace(/^export\s+default\s+(.+);?\s*$/gm, (_match, expr: string) => {
    return `__exports["default"] = (${expr.replace(/;\s*$/, '')});`;
  });

  return [
    importStatements.join('\n'),
    body,
    exportAssignments.join('\n'),
  ].join('\n');
}

let bindingCounter = 0;

function transpileImport(clause: string, specifier: string): string {
  const ref = `__mod_${bindingCounter++}`;
  const requireCall = `const ${ref} = __require(${JSON.stringify(specifier)});`;

  // Namespace import: `* as Name`
  const nsMatch = /^\*\s+as\s+([A-Za-z0-9_$]+)$/.exec(clause);
  if (nsMatch) {
    return `${requireCall}\nconst ${nsMatch[1]} = ${ref};`;
  }

  // Named imports: `{ a, b as c }`
  const namedMatch = /^\{([^}]*)\}$/.exec(clause);
  if (namedMatch) {
    const bindings = namedMatch[1]!
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const asMatch = /^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/.exec(part);
        if (asMatch) {
          return `const ${asMatch[2]} = ${ref}[${JSON.stringify(asMatch[1])}];`;
        }
        return `const ${part} = ${ref}[${JSON.stringify(part)}];`;
      })
      .join('\n');
    return `${requireCall}\n${bindings}`;
  }

  // Default import: `Name`
  const defaultMatch = /^([A-Za-z0-9_$]+)$/.exec(clause);
  if (defaultMatch) {
    return `${requireCall}\nconst ${defaultMatch[1]} = ${ref}.default ?? ${ref};`;
  }

  throw new Error(`compiledModuleEval: unsupported import clause "${clause}"`);
}

/**
 * Evaluate compiled ET fixture ESM in-process, resolving its `@lynx-js/react/*`
 * imports to the live runtime modules. Returns the module's exports.
 */
export function evaluateCompiledModule<T extends object = Record<string, unknown>>(
  code: string,
): T {
  const cjs = transpileEsmToCjs(code);
  const exports: Record<string, unknown> = {};
  // eslint-disable-next-line no-new-func
  const fn = new Function('__require', '__exports', `'use strict';\n${cjs}\nreturn __exports;`);
  return fn(requireModule, exports) as T;
}
