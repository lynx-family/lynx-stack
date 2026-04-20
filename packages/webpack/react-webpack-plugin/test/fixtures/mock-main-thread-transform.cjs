'use strict';

exports.transformReactLynxSync = function transformReactLynxSync(content) {
  const shouldEmitTemplate = content.includes('__emitTemplate');

  return {
    code: shouldEmitTemplate
      ? 'const _et_fixture = 1;'
      : 'const __snapshot_fixture = 1;',
    map: undefined,
    errors: [],
    warnings: [],
    uiSourceMapRecords: [],
    elementTemplates: shouldEmitTemplate
      ? [
        {
          templateId: '_et_fixture',
          compiledTemplate: { tag: 'view' },
          sourceFile: 'fixture.tsx',
        },
      ]
      : undefined,
  };
};
