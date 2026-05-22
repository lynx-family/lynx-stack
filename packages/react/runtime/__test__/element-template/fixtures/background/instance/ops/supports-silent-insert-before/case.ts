import { BackgroundElementTemplateInstance, globalCommitContext, runCase } from '../../_shared.js';

export function run() {
  return runCase(() => {
    const root = new BackgroundElementTemplateInstance('root');
    const child = new BackgroundElementTemplateInstance('view');
    root.insertBefore(child, null, true);

    return globalCommitContext.ops;
  });
}
