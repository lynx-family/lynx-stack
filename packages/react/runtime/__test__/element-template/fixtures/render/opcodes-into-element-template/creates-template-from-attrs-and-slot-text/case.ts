import {
  __OpAttr,
  __OpBegin,
  __OpEnd,
  __OpSlot,
  __OpText,
  renderOpcodesIntoElementTemplate,
  runCase,
} from '../_shared.js';

export function run() {
  return runCase(({ root, nativeLog }) => {
    const opcodes = [
      __OpBegin,
      { type: '_et_foo', props: {} },
      __OpAttr,
      'attributeSlots',
      ['test'],
      __OpSlot,
      1,
      __OpText,
      'Hello',
      __OpEnd,
    ];

    const { rootRefs } = renderOpcodesIntoElementTemplate(opcodes);
    rootRefs.forEach(rootRef => __AppendElement(root as FiberElement, rootRef));

    const rootChild = root.children?.[0];

    return {
      output: {
        rootChild,
      },
      files: {
        'native-log.txt': nativeLog,
      },
    };
  });
}
