// ESM (imported via `../loader.cjs`), not `ProvidePlugin`:
// `@lynx-js/react/refresh` is an async module under async externals, and only a
// harmony import edge is awaited, so the injected footer sees resolved
// `isComponent`/`flush`.
import { flush, isComponent } from '@lynx-js/react/refresh';

// eslint-disable-next-line
const getExports = m => m.exports || m.__proto__.exports;

function isSafeExport(key) {
  return (
    key === '__esModule'
    || key === '__N_SSG'
    || key === '__N_SSP'
    || key === 'config'
  );
}

function registerExports(moduleExports, moduleId) {
  globalThis['__PREFRESH__'].register(moduleExports, moduleId + ' %exports%');
  if (moduleExports == null || typeof moduleExports !== 'object') return;

  for (const key in moduleExports) {
    if (isSafeExport(key)) continue;
    const exportValue = moduleExports[key];
    const typeID = moduleId + ' %exports% ' + key;
    globalThis['__PREFRESH__'].register(exportValue, typeID);
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

export { flush, getExports, registerExports, shouldBind };
