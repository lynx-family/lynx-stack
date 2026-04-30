import { __OpText, renderOpcodesIntoElementTemplate, runCase } from '../_shared.js';

export function run() {
  return runCase(({ root, nativeLog }) => {
    const opcodes = [__OpText, 'root'];

    const { rootRefs } = renderOpcodesIntoElementTemplate(opcodes);
    rootRefs.forEach(rootRef => __AppendElement(root as FiberElement, rootRef));

    return {
      output: {
        rootChildren: root.children ?? [],
      },
      files: {
        'native-log.txt': nativeLog,
      },
    };
  });
}
