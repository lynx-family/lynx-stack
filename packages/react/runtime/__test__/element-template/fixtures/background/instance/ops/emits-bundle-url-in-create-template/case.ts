import { BackgroundElementTemplateInstance, globalCommitContext, runCase } from '../../_shared.js';

export function run() {
  return runCase(() => {
    const instance = new BackgroundElementTemplateInstance('dynamic-entry:_et_foo');

    instance.emitCreate();

    return globalCommitContext.ops;
  });
}
