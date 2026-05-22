/// <reference types="@rspack/test-tools/rstest" />

import { a } from 'pkg-a';
import { b } from 'pkg-b';
import { c } from 'pkg-c';
import { f } from 'pkg-f';

const d = await import('pkg-d');
const e = await import('pkg-e');

console.info(a, b, c, d, e, f);

it('should call loadScript only once per (bundle, section) pair', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const background = fs.readFileSync(
    path.resolve(__dirname, 'main:background.js'),
    'utf-8',
  );
  const mainThread = fs.readFileSync(
    path.resolve(__dirname, 'main:main-thread.js'),
    'utf-8',
  );

  // Use concatenation to avoid the literal pattern appearing inside this compiled file itself.

  // pkg-a and pkg-b share the same (url, sectionPath). Only ONE createLoadExternalSync call
  // should be generated for that pair; pkg-b reuses pkg-a's result directly.
  // pkg-c has a different bundle URL, so it gets its own call.
  // => Exactly one call per handler (2 total), not one per external (3 total).

  // Match actual invocations of the form `createLoadExternalSync/Async(handlerN, ...`
  // The function definitions use `(handler,` (no digit), so they won't be counted here.
  const syncH0 = 'createLoadExternalSync' + '(handler0,';
  const syncH1 = 'createLoadExternalSync' + '(handler1,';
  const syncH2 = 'createLoadExternalSync' + '(handler2,';
  const asyncH2 = 'createLoadExternalAsync' + '(handler2,';

  // Sync-side: handler0 and handler1 each get exactly one Sync call (PkgB is merged into PkgA).
  expect(background.split(syncH0).length).toBe(2);
  expect(background.split(syncH1).length).toBe(2);
  expect(mainThread.split(syncH0).length).toBe(2);
  expect(mainThread.split(syncH1).length).toBe(2);

  // handler2 is shared by async pkg-d/pkg-e and sync pkg-f. The async group merges
  // (PkgE reuses PkgD), so exactly one Async call. The sync pkg-f must NOT merge
  // with the async group (different runtime shape), so exactly one Sync call on handler2.
  expect(background.split(asyncH2).length).toBe(2);
  expect(background.split(syncH2).length).toBe(2);
  expect(mainThread.split(asyncH2).length).toBe(2);
  expect(mainThread.split(syncH2).length).toBe(2);

  // PkgB reuses PkgA's already-loaded global — no createLoadExternal call.
  // The === undefined guard is preserved so host-injected values are not overwritten.
  const pkgBAssignment = '["PkgB"] === undefined ? '
    + 'lynx[Symbol.for(\'__LYNX_EXTERNAL_GLOBAL__\')]["PkgA"] : '
    + 'lynx[Symbol.for(\'__LYNX_EXTERNAL_GLOBAL__\')]["PkgB"]';
  expect(background).toContain(pkgBAssignment);
  expect(mainThread).toContain(pkgBAssignment);

  // PkgE reuses PkgD (both async, same section) — no extra createLoadExternalAsync call.
  const pkgEAssignment = '["PkgE"] === undefined ? '
    + 'lynx[Symbol.for(\'__LYNX_EXTERNAL_GLOBAL__\')]["PkgD"] : '
    + 'lynx[Symbol.for(\'__LYNX_EXTERNAL_GLOBAL__\')]["PkgE"]';
  expect(background).toContain(pkgEAssignment);
  expect(mainThread).toContain(pkgEAssignment);
});
