import {
  BackgroundElementTemplateInstance,
  GlobalCommitContext,
  resetGlobalCommitContext,
  runCase,
} from '../../_shared.js';

export function run() {
  return runCase(() => {
    const instance = new BackgroundElementTemplateInstance('view');
    const props = { a: 1 };
    instance.setAttribute('attributeSlots', [props]);
    resetGlobalCommitContext();

    instance.setAttribute('attributeSlots', [props]);
    const stream = GlobalCommitContext.ops;
    resetGlobalCommitContext();

    return stream;
  });
}
