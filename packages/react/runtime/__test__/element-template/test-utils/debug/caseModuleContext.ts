// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Static rspack context over every `case.ts` / `case.tsx` fixture entry.
//
// The fixture runners previously did `await import(pathToFileURL(casePath))` on
// a `.ts`/`.tsx` source path computed at runtime. Under rstest that escapes the
// rspack bundler into Node's native ESM loader, which cannot load `.tsx` nor
// resolve the relative `../../../src/**` (TypeScript) imports the case files
// pull in. That is the root cause of the `Unknown file extension ".tsx"` and
// `Cannot find module '.../_shared.js'` failures.
//
// `import.meta.webpackContext` lets rspack statically discover and bundle all
// `case.*` files (and, transitively, their `_shared.*` + runtime imports, with
// the JSX/TSX transform loader applied). Fixture runners look the module up by
// its fixture-relative key instead of importing an absolute filesystem path.

import path from 'node:path';

interface CaseFixtureModule {
  run: (context: { fixtureDir: string; fixtureName: string }) => Promise<unknown> | unknown;
  reportErrorCount?: number;
}

// Recurse so nested fixture directories are included. The regex excludes
// `_shared` helpers (they are pulled in transitively, never run directly).
const caseContext = (import.meta as unknown as {
  webpackContext: (
    request: string,
    options: { recursive: boolean; regExp: RegExp },
  ) => {
    keys(): string[];
    (id: string): CaseFixtureModule;
  };
}).webpackContext('../../../element-template/fixtures', {
  recursive: true,
  regExp: /\/case\.tsx?$/,
});

// Map every fixture-relative POSIX path (e.g. `patch/state-update`) to its
// context key (e.g. `./patch/state-update/case.tsx`).
const fixtureDirToKey = new Map<string, string>();
for (const key of caseContext.keys()) {
  // key looks like `./<fixture>/case.tsx`
  const withoutPrefix = key.replace(/^\.\//, '');
  const fixtureRel = withoutPrefix.replace(/\/case\.tsx?$/, '');
  fixtureDirToKey.set(fixtureRel, key);
}

const FIXTURES_ROOT_MARKER = `${path.sep}fixtures${path.sep}`;

/**
 * Resolve a fixture `case.*` module from its on-disk directory, via the static
 * rspack context. `casePath` / `fixtureDir` are absolute paths under the
 * `fixtures/` tree.
 */
export function loadCaseModule(casePath: string): CaseFixtureModule {
  const normalized = casePath.split(path.sep).join('/');
  const idx = normalized.indexOf('/fixtures/');
  if (idx === -1) {
    throw new Error(`loadCaseModule: path is not under fixtures/: ${casePath}`);
  }
  const fixtureRel = normalized
    .slice(idx + '/fixtures/'.length)
    .replace(/\/case\.tsx?$/, '');

  const key = fixtureDirToKey.get(fixtureRel);
  if (!key) {
    throw new Error(
      `loadCaseModule: no compiled case module for fixture "${fixtureRel}". `
        + `Known: ${[...fixtureDirToKey.keys()].join(', ')}`,
    );
  }
  return caseContext(key);
}

export { FIXTURES_ROOT_MARKER };
export type { CaseFixtureModule };
