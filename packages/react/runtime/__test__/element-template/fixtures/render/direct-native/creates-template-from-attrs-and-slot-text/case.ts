import { h } from 'preact';
import { renderToElementTemplate, runCase } from '../_shared.js';

export function run() {
  return runCase(({ root, nativeLog }) => {
    const { rootRefs } = renderToElementTemplate(h('_et_foo', { attributeSlots: ['test'], $1: 'Hello' }));
    rootRefs.forEach(rootRef => __InsertNodeToElementTemplate(root, 0, rootRef, null));

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
