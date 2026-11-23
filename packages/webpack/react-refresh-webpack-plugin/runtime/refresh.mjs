// ESM (imported via `../loader.cjs`), not `ProvidePlugin`:
// `@lynx-js/react/refresh` is an async module under async externals, and only a
// harmony import edge is awaited, so the injected footer sees resolved
// `isComponent`/`flush`/`createRefreshRuntime`.
import * as ReactRefresh from '@lynx-js/react/refresh';

const { flush: legacyFlush, isComponent } = ReactRefresh;

// `refresh.mjs` is bundled into each template bundle (never externalized), so
// owning the runtime at module scope gives each bundle an isolated registry
// even when `@lynx-js/react/refresh` itself is a shared sync or async external.
const runtime = typeof ReactRefresh.createRefreshRuntime === 'function'
  ? ReactRefresh.createRefreshRuntime()
  : null;

function resolveRegistry() {
  if (runtime) {
    return runtime;
  }
  if (typeof globalThis !== 'undefined') {
    return globalThis.__PREFRESH__ || null;
  }
  return null;
}

// eslint-disable-next-line
const getExports = m => {
  const exp = m.exports || m.__proto__.exports;
  // When `@lynx-js/react/refresh` is an async external (`externalsType: 'promise'`),
  // an ESM consumer module is wrapped in `__webpack_require__.a`, which sets
  // `module.exports` to a wrapper Promise holding the real namespace object on
  // `Symbol("rspack exports")` / `Symbol("webpack exports")`.
  if (exp && typeof exp.then === 'function') {
    const symbols = Object.getOwnPropertySymbols(exp);
    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      const desc = String(sym);
      if (
        desc === 'Symbol(rspack exports)'
        || desc === 'Symbol(webpack exports)'
      ) {
        return exp[sym];
      }
    }
  }
  return exp;
};

function isSafeExport(key) {
  return (
    key === '__esModule'
    || key === '__N_SSG'
    || key === '__N_SSP'
    || key === 'config'
  );
}

function registerExports(moduleExports, moduleId) {
  const registry = resolveRegistry();
  if (!registry) return;

  registry.register(moduleExports, moduleId + ' %exports%');
  if (moduleExports == null || typeof moduleExports !== 'object') return;

  for (const key in moduleExports) {
    if (isSafeExport(key)) continue;
    const exportValue = moduleExports[key];
    const typeID = moduleId + ' %exports% ' + key;
    registry.register(exportValue, typeID);
  }
}

function flush() {
  if (runtime) {
    runtime.flush();
    return;
  }
  legacyFlush();
}

const shouldBind = m => {
  let isCitizen = false;
  const moduleExports = getExports(m);

  if (isComponent(moduleExports)) {
    isCitizen = true;
  }

  if (
    moduleExports === undefined
    || moduleExports === null
    || typeof moduleExports !== 'object'
  ) {
    isCitizen = isCitizen || false;
  } else {
    for (const key in moduleExports) {
      if (key === '__esModule') continue;

      const exportValue = moduleExports[key];
      if (isComponent(exportValue)) {
        isCitizen = isCitizen || true;
      }
    }
  }

  return isCitizen;
};

export { flush, getExports, registerExports, shouldBind };
