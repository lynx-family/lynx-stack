'use strict';

exports.transformReactLynxSync = function transformReactLynxSync(content) {
  const shouldEmitTemplate = content.includes('__emitTemplate');
  const hasMainThreadProgrammability = content.includes(
    '__mainThreadProgrammability',
  );
  const hasInvalidRuntimeRequirements = content.includes(
    '__invalidRuntimeRequirements',
  );

  const isLegacy = content.includes('__legacy');

  return {
    code: content.includes('__legacyWorklet')
      ? 'loadWorkletRuntime() && registerWorkletInternal();'
      : shouldEmitTemplate
      ? 'const _et_fixture = 1;'
      : 'const __snapshot_fixture = 1;',
    map: undefined,
    errors: [],
    warnings: [],
    uiSourceMapRecords: [],
    runtimeRequirements: isLegacy
      ? undefined
      : hasInvalidRuntimeRequirements
      ? { mainThreadProgrammability: 'invalid' }
      : { mainThreadProgrammability: hasMainThreadProgrammability },
    elementTemplates: shouldEmitTemplate
      ? [
        {
          templateId: '_et_fixture',
          compiledTemplate: { type: 'view' },
          sourceFile: 'fixture.tsx',
        },
      ]
      : undefined,
  };
};
