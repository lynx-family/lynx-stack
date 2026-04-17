import {
  BackgroundElementTemplateInstance,
  GlobalCommitContext,
  resetGlobalCommitContext,
  runCase,
} from '../../_shared.js';

export function run() {
  return runCase(() => {
    const instance = new BackgroundElementTemplateInstance('view');
    instance.setAttribute('attributeSlots', [{ a: 1 }]);
    resetGlobalCommitContext();

    instance.setAttribute('attributeSlots', []);
    const stream = GlobalCommitContext.ops;
    resetGlobalCommitContext();

    return stream;
  });
}
