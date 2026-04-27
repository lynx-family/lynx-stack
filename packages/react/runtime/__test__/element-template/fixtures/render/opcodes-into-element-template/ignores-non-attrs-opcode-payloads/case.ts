import { __OpAttr, __OpBegin, __OpEnd, renderOpcodesIntoElementTemplate, runCase } from '../_shared.js';

export function run() {
  return runCase(({ root, nativeLog }) => {
    const opcodes = [
      __OpBegin,
      { type: '_et_foo', props: {} },
      __OpAttr,
      'ignored',
      { 0: { id: 'test' } },
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
