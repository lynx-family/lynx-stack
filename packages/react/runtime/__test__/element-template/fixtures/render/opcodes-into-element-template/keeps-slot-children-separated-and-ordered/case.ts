import { __OpBegin, __OpEnd, __OpSlot, __OpText, renderOpcodesIntoElementTemplate, runCase } from '../_shared.js';

export function run() {
  return runCase(({ root, nativeLog }) => {
    const opcodes = [
      __OpBegin,
      { type: '_et_foo', props: {} },
      __OpSlot,
      0,
      __OpText,
      'A',
      __OpSlot,
      1,
      __OpText,
      'B',
      __OpEnd,
    ];

    const { rootRefs } = renderOpcodesIntoElementTemplate(opcodes);
    rootRefs.forEach(rootRef => __AppendElement(root as FiberElement, rootRef));

    return {
      output: {
        rootChild: root.children?.[0],
      },
      files: {
        'native-log.txt': nativeLog,
      },
    };
  });
}
