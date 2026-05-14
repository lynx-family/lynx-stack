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
    const props = { a: 1 };
    instance.setAttribute('attributeSlots', [props]);
    markElementTemplateHydrated();
    instance.markMaterializedByHydration();
    resetGlobalCommitContext();

    instance.setAttribute('attributeSlots', [props]);
    const stream = globalCommitContext.ops;
    resetGlobalCommitContext();

    return stream;
  });
}
