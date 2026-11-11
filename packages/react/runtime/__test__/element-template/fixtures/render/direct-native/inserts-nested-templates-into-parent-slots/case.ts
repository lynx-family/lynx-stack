import { h } from 'preact';
import { renderToElementTemplate, runCase } from '../_shared.js';

export function run() {
  return runCase(({ root, nativeLog }) => {
    const { rootRefs } = renderToElementTemplate(
      h('_et_outer', { $0: h('_et_inner', { attributeSlots: ['inner'], $0: 'X' }) }),
    );
    rootRefs.forEach(rootRef => __InsertNodeToElementTemplate(root, 0, rootRef, null));

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
