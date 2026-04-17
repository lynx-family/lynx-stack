import {
  BackgroundElementTemplateInstance,
  BackgroundElementTemplateSlot,
  GlobalCommitContext,
  runCase,
} from '../../_shared.js';

export function run() {
  return runCase(() => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);

    const child = new BackgroundElementTemplateInstance('view');
    slot.insertBefore(child, null, true);

    return GlobalCommitContext.ops;
  });
}
