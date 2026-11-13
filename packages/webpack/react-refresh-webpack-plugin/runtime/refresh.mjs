// ESM (imported via `../loader.cjs`), not `ProvidePlugin`:
// `@lynx-js/react/refresh` is an async module under async externals, and only a
// harmony import edge is awaited, so the injected footer sees resolved
// `isComponent`/`flush`/`createRefreshRuntime`.
import * as ReactRefresh from '@lynx-js/react/refresh';
import defaultRefreshHolder from './refreshRuntime.cjs';

const { flush: legacyFlush, isComponent } = ReactRefresh;

function initHolder(holder) {
  if (!holder) {
    return null;
  }
  if (typeof ReactRefresh.createRefreshRuntime === 'function') {
    if (!holder.runtime) {
      holder.runtime = ReactRefresh.createRefreshRuntime();
    }
    holder.legacy = false;
  } else {
    holder.legacy = true;
  }
  return holder;
}

initHolder(defaultRefreshHolder);

function resolveRegistry() {
  const target = initHolder(defaultRefreshHolder);
  if (target && target.runtime) {
    return target.runtime;
  }
  if (target && target.legacy && typeof globalThis !== 'undefined') {
    return globalThis.__PREFRESH__ || null;
  }
  return null;
}

function createSignatureFunctionForTransform() {
  let status = 'begin';
  let savedType;

  return function(type, key, forceReset, getCustomHooks) {
    const registry = resolveRegistry();
    if (!registry) {
      return type;
    }
    if (!savedType) savedType = type;

    status = registry.sign(
      type || savedType,
      key,
      forceReset,
      getCustomHooks,
      status,
    );
    return type;
  };
}

function register(type, moduleId, id) {
  const registry = resolveRegistry();
  if (registry) {
    registry.register(type, moduleId + ' ' + id);
  }
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
  const target = initHolder(defaultRefreshHolder);
  if (target && target.runtime) {
    target.runtime.flush();
    return;
  }
  if (target && target.legacy) {
    legacyFlush();
  }
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

export {
  createSignatureFunctionForTransform,
  flush,
  getExports,
  register,
  registerExports,
  shouldBind,
};
