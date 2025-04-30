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

it('should not have experimental/lazy/import imported', () => {
  if (__BACKGROUND__) {
    expect(lynx[sExportsReact]).toBeUndefined();
    expect(lynx[sExportsReactLepus]).toBeUndefined();
    expect(lynx[sExportsReactInternal]).toBeUndefined();
    expect(lynx[sExportsJSXRuntime]).toBeUndefined();
    expect(lynx[sExportsJSXDevRuntime]).toBeUndefined();
    expect(lynx[sExportsLegacyReactRuntime]).toBeUndefined();
  } else {
    expect(globalThis[sExportsReact]).toBeUndefined();
    expect(globalThis[sExportsReactLepus]).toBeUndefined();
    expect(globalThis[sExportsReactInternal]).toBeUndefined();
    expect(globalThis[sExportsJSXRuntime]).toBeUndefined();
    expect(globalThis[sExportsJSXDevRuntime]).toBeUndefined();
    expect(globalThis[sExportsLegacyReactRuntime]).toBeUndefined();
  }
});
