// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export const target = __LEPUS__ ? globalThis : lynx;

export const sExportsReact = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react)');
export const sExportsReactCompat = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/compat)');
export const sExportsReactLepus = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/lepus)');
export const sExportsReactInternal = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/internal)');
export const sExportsJSXRuntime = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/jsx-runtime)');
export const sExportsJSXDevRuntime = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/jsx-dev-runtime)');
export const sExportsLegacyReactRuntime = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/legacy-react-runtime)');
