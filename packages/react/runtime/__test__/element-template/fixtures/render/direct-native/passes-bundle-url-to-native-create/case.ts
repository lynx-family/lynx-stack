import { h } from 'preact';
import { renderToElementTemplate, runCase } from '../_shared.js';

export function run() {
  return runCase(({ root, nativeLog }) => {
    const { rootRefs } = renderToElementTemplate(h('dynamic-entry:_et_foo', {}));
    rootRefs.forEach(rootRef => __InsertNodeToElementTemplate(root, 0, rootRef, null));

    return {
      files: {
        'native-log.txt': nativeLog,
      },
    };
  });
}
