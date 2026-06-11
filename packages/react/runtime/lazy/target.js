// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export const target = __LEPUS__ ? globalThis : lynx;

export const RUNTIME_BACKEND_SNAPSHOT = 'Snapshot';
export const RUNTIME_BACKEND_ELEMENT_TEMPLATE = 'Element Template';
export const sRuntimeBackend = Symbol.for('__REACT_LYNX_RUNTIME_BACKEND__');

export const sExportsReact = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react)');
export const sExportsReactCompat = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/compat)');
export const sExportsReactLepus = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/lepus)');
export const sExportsReactInternal = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/internal)');
export const sExportsJSXRuntime = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/jsx-runtime)');
export const sExportsJSXDevRuntime = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/jsx-dev-runtime)');
export const sExportsLegacyReactRuntime = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/legacy-react-runtime)');

export function registerLazyRuntimeBackend(backend) {
  const currentBackend = target[sRuntimeBackend];

  if (currentBackend !== undefined && currentBackend !== backend) {
    throw new Error(
      `ReactLynx runtime backend mismatch: the current template uses ${
        String(currentBackend)
      }, but this bundle was built for ${backend}. Snapshot and Element Template templates cannot share lazy bundles. Rebuild the main template and lazy bundle with the same elementTemplate setting.`,
    );
  }

  Object.defineProperty(target, sRuntimeBackend, {
    value: backend,
    enumerable: false,
    writable: false,
    configurable: true,
  });
}
