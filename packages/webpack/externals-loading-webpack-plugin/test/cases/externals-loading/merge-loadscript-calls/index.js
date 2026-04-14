import { a } from 'pkg-a';
import { b } from 'pkg-b';
import { c } from 'pkg-c';

console.info(a, b, c);

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

  // Match actual invocations of the form `createLoadExternalSync(handlerN, ...` — the
  // function definition uses `(handler,` (no digit), so it won't be counted here.
  const h0 = 'createLoadExternalSync' + '(handler0,';
  const h1 = 'createLoadExternalSync' + '(handler1,';

  expect(background.split(h0).length).toBe(2); // exactly 1 call for handler0
  expect(background.split(h1).length).toBe(2); // exactly 1 call for handler1
  expect(mainThread.split(h0).length).toBe(2);
  expect(mainThread.split(h1).length).toBe(2);

  // PkgB should reuse PkgA's already-loaded global — no createLoadExternal call.
  // The === undefined guard is preserved so host-injected values are not overwritten.
  const pkgBAssignment = '["PkgB"] === undefined ? '
    + 'lynx[Symbol.for(\'__LYNX_EXTERNAL_GLOBAL__\')]["PkgA"] : '
    + 'lynx[Symbol.for(\'__LYNX_EXTERNAL_GLOBAL__\')]["PkgB"]';
  expect(background).toContain(pkgBAssignment);
  expect(mainThread).toContain(pkgBAssignment);
});
