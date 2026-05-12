/// <reference types="@rstest/core/globals" />

import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(__filename);

const SYNC_MARKER = Symbol.for('test.syncThen');

function makeSyncThenPromise(value) {
  const p = Promise.resolve(value);
  const syncThen = function(onF) {
    if (!onF) return p;
    var ret;
    try {
      ret = onF(value);
    } catch (e) {
      return Promise.reject(e);
    }
    return makeSyncThenPromise(ret);
  };
  syncThen[SYNC_MARKER] = true;
  p.then = syncThen;
  return p;
}

globalThis.lynx = {
  loadLazyBundle: rstest.fn(function loadLazyBundle(request) {
    return makeSyncThenPromise(
      require(path.join(__dirname, `${request}.rspack.bundle.cjs`)),
    );
  }),
  requireModuleAsync: rstest.fn(function requireModuleAsync(_url, cb) {
    cb(null, {});
  }),
};

it('preserves the inner sync-then promise when only one handler pushes one promise', () => {
  const chunkId = Object.keys(__webpack_require__.lynx_aci)[0];
  expect(chunkId).toBeTruthy();

  const out = __webpack_require__.e(chunkId);
  expect(out.then[SYNC_MARKER]).toBe(true);

  let observed;
  out.then((v) => {
    observed = v;
  });
  expect(observed).toBeDefined();
});

it('falls back to Promise.all (native then) when more than one promise is pushed', async () => {
  const savedRequire = __webpack_require__.f.require;
  __webpack_require__.f.require = () => {
    /* swap out f.require so the chunk loader doesn't add its own promise */
  };
  __webpack_require__.f.extraA = (_id, list) => list.push(Promise.resolve('a'));
  __webpack_require__.f.extraB = (_id, list) => list.push(Promise.resolve('b'));
  try {
    const out = __webpack_require__.e('any-chunk');
    expect(out.then[SYNC_MARKER]).toBeUndefined();
    const values = await out;
    expect(values).toBeInstanceOf(Array);
    expect(values).toContain('a');
    expect(values).toContain('b');
  } finally {
    __webpack_require__.f.require = savedRequire;
    delete __webpack_require__.f.extraA;
    delete __webpack_require__.f.extraB;
  }
});

it('chunk loading still works end to end', async () => {
  await import(/* webpackChunkName: 'dynamic' */ './dynamic.js');
  expect(__webpack_require__.lynx_aci).toHaveProperty('dynamic');
  expect(lynx.loadLazyBundle).toBeCalled();
});
