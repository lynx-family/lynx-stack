/// <reference types="vitest/globals" />

const sExportsReact = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react)');
const sExportsReactLepus = Symbol.for(
  '__REACT_LYNX_EXPORTS__(@lynx-js/react/lepus)',
);
const sExportsReactInternal = Symbol.for(
  '__REACT_LYNX_EXPORTS__(@lynx-js/react/internal)',
);
const sExportsJSXRuntime = Symbol.for(
  '__REACT_LYNX_EXPORTS__(@lynx-js/react/jsx-runtime)',
);
const sExportsJSXDevRuntime = Symbol.for(
  '__REACT_LYNX_EXPORTS__(@lynx-js/react/jsx-dev-runtime)',
);
const sExportsLegacyReactRuntime = Symbol.for(
  '__REACT_LYNX_EXPORTS__(@lynx-js/react/legacy-react-runtime)',
);

export {};

it('should have experimental/lazy/import imported', async () => {
  try {
    await import('https://www/a.js');
  } catch {
    // ignore error
  }
  if (__BACKGROUND__) {
    expect(lynx[sExportsReact]).not.toBeUndefined();
    expect(lynx[sExportsReactLepus]).not.toBeUndefined();
    expect(lynx[sExportsReactInternal]).not.toBeUndefined();
    expect(lynx[sExportsJSXRuntime]).not.toBeUndefined();
    expect(lynx[sExportsJSXDevRuntime]).not.toBeUndefined();
    expect(lynx[sExportsLegacyReactRuntime]).not.toBeUndefined();
  } else {
    expect(globalThis[sExportsReact]).not.toBeUndefined();
    expect(globalThis[sExportsReactLepus]).not.toBeUndefined();
    expect(globalThis[sExportsReactInternal]).not.toBeUndefined();
    expect(globalThis[sExportsJSXRuntime]).not.toBeUndefined();
    expect(globalThis[sExportsJSXDevRuntime]).not.toBeUndefined();
    expect(globalThis[sExportsLegacyReactRuntime]).not.toBeUndefined();
  }
});
