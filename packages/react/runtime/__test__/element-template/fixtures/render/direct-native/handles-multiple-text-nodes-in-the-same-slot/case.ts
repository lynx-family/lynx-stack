import { h } from 'preact';
import { renderToElementTemplate, runCase } from '../_shared.js';

export function run() {
  return runCase(({ root, nativeLog }) => {
    const { rootRefs } = renderToElementTemplate(h('_et_parent', { $0: ['A', 'B'] }));
    rootRefs.forEach(rootRef => __InsertNodeToElementTemplate(root, 0, rootRef, null));

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
