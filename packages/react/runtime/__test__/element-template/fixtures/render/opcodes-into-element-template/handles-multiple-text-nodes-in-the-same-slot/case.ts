import { __OpBegin, __OpEnd, __OpSlot, __OpText, renderOpcodesIntoElementTemplate, runCase } from '../_shared.js';

export function run() {
  return runCase(({ root, nativeLog }) => {
    const opcodes = [
      __OpBegin,
      { type: '_et_parent', props: {} },
      __OpSlot,
      0,
      __OpText,
      'A',
      __OpText,
      'B',
      __OpEnd,
    ];

    const { rootRefs } = renderOpcodesIntoElementTemplate(opcodes);
    rootRefs.forEach(rootRef => __AppendElement(root as FiberElement, rootRef));

    return {
      output: {
        slotChildren: root.children?.[0]?.children?.[0]?.children ?? [],
      },
      files: {
        'native-log.txt': nativeLog,
      },
    };
  });
}
