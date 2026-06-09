import { __OpBegin, __OpEnd, renderOpcodesIntoElementTemplate, runCase } from '../_shared.js';

export function run() {
  return runCase(({ root, nativeLog }) => {
    const opcodes = [
      __OpBegin,
      { type: 'dynamic-entry:_et_foo', props: {} },
      __OpEnd,
    ];

    const { rootRefs } = renderOpcodesIntoElementTemplate(opcodes);
    rootRefs.forEach(rootRef => __InsertNodeToElementTemplate(root as FiberElement, 0, rootRef, null));

    return {
      files: {
        'native-log.txt': nativeLog,
      },
    };
  });
}
