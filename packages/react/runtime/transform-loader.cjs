// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Custom rspack loader that runs `transformReactLynxSync` on `.jsx`/`.tsx`
// sources. react/runtime tests its OWN `src`, so we cannot use
// `pluginReactLynx` (which targets the published package). Instead we replicate
// the `transformReactLynxPlugin` behaviour as an rspack loader, wired through
// `tools.bundlerChain`.
//
// The loader supports two modes via the `mode` option:
//   - 'snapshot'        -> main suite (snapshot render path)
//   - 'elementTemplate' -> ET suite (element-template render path)
//
// `filename` is held CONSTANT at 'test' for the snapshot/elementTemplate
// transform options because the snapshot `uniqueID` hash derives from it; the
// inline snapshots in the test files were captured with this constant.

const path = require('node:path');

const { transformReactLynxSync } = require('@lynx-js/react-transform');

module.exports = function transformLoader(sourceText) {
  const callback = this.async();
  const resourcePath = this.resourcePath;
  const relativePath = path.basename(resourcePath);

  if (!relativePath.endsWith('.jsx') && !relativePath.endsWith('.tsx')) {
    callback(null, sourceText);
    return;
  }

  const options = this.getOptions() || {};
  const mode = options.mode === 'elementTemplate' ? 'elementTemplate' : 'snapshot';
  const runtimePkg = options.runtimePkg;

  const transformConfig = {
    mode: 'test',
    pluginName: '',
    filename: relativePath,
    sourcemap: true,
    dynamicImport: false,
    directiveDCE: false,
    defineDCE: false,
    shake: false,
    compat: false,
    worklet: false,
    refresh: false,
    cssScope: false,
  };

  if (mode === 'elementTemplate') {
    transformConfig.elementTemplate = {
      preserveJsx: false,
      runtimePkg,
      jsxImportSource: '@lynx-js/react',
      filename: 'test',
      target: 'MIXED',
    };
  } else {
    transformConfig.snapshot = {
      preserveJsx: false,
      runtimePkg,
      jsxImportSource: '@lynx-js/react',
      filename: 'test',
      target: 'MIXED',
    };
  }

  let result;
  try {
    result = transformReactLynxSync(sourceText, transformConfig);
  } catch (error) {
    callback(error);
    return;
  }

  let code = result.code;
  if (
    mode === 'elementTemplate'
    && result.elementTemplates
    && result.elementTemplates.length > 0
  ) {
    code += `\nif (globalThis.__REGISTER_ELEMENT_TEMPLATES__) { globalThis.__REGISTER_ELEMENT_TEMPLATES__(${
      JSON.stringify(result.elementTemplates)
    }); }\n`;
  }

  callback(null, code, result.map ?? null);
};
