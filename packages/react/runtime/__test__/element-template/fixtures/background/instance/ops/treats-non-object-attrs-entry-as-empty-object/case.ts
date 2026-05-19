import {
  BackgroundElementTemplateInstance,
  globalCommitContext,
  markElementTemplateHydrated,
  resetGlobalCommitContext,
  runCase,
} from '../../_shared.js';

export function run() {
  return runCase(() => {
    const instance = new BackgroundElementTemplateInstance('view');
    instance.setAttribute('attributeSlots', [{ a: 1 }]);
    markElementTemplateHydrated();
    instance.markMaterializedByHydration();
    resetGlobalCommitContext();

    instance.setAttribute('attributeSlots', [null]);
    const stream = globalCommitContext.ops;
    resetGlobalCommitContext();

    return stream;
  });
}
