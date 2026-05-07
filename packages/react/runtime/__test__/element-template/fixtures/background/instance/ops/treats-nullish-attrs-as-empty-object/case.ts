import {
  BackgroundElementTemplateInstance,
  globalCommitContext,
  resetGlobalCommitContext,
  runCase,
} from '../../_shared.js';

export function run() {
  return runCase(() => {
    const instance = new BackgroundElementTemplateInstance('view');
    instance.setAttribute('attributeSlots', [{ a: 1 }]);
    resetGlobalCommitContext();

    instance.setAttribute('attributeSlots', []);
    const stream = globalCommitContext.ops;
    resetGlobalCommitContext();

    return stream;
  });
}
