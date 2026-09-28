'use strict';

exports.transformReactLynxSync = function transformReactLynxSync(
  _content,
  options,
) {
  const isMainThread = options.worklet?.target === 'LEPUS';

  return {
    code: isMainThread
      ? `
const __workletRuntimeLoaded = loadWorkletRuntime(
  typeof globDynamicComponentEntry === 'undefined'
    ? undefined
    : globDynamicComponentEntry,
);
__workletRuntimeLoaded && registerWorkletInternal(
  'main-thread',
  'legacy-transform:1',
  function legacyWorklet() {},
);
`
      : 'export const legacyBackground = true;',
    map: undefined,
    errors: [],
    warnings: [],
    uiSourceMapRecords: [],
  };
};
