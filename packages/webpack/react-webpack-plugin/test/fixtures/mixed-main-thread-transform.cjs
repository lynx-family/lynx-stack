// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
'use strict';

const { transformReactLynxSync } = require('@lynx-js/react/transform');

exports.transformReactLynxSync = function(content, options) {
  if (content.includes('__legacy_plain_fixture')) {
    return { code: 'export const handler = null;', errors: [], warnings: [] };
  }
  if (!content.includes('__legacy_worklet_fixture')) {
    return transformReactLynxSync(content, options);
  }
  const definition = {
    id: 'legacy-transform:1',
    code: `loadWorkletRuntime() && registerWorkletInternal(
      'main-thread', 'legacy-transform:1',
      function legacyWorklet() { return 'injected-worklet'; },
    );`,
  };
  return {
    code: options.worklet.target === 'LEPUS'
      ? `import { loadWorkletRuntime } from '@lynx-js/react/internal';
        ${definition.code}
        export const handler = null;`
      : 'export const handler = null;',
    errors: [],
    warnings: [],
    uiSourceMapRecords: [],
    definesForWorklet: [definition],
  };
};
