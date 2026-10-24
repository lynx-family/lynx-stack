import { renderToElementTemplate, runCase } from '../_shared.js';

export function run() {
  return runCase(({ root, nativeLog }) => {
    const { rootRefs } = renderToElementTemplate('root');
    rootRefs.forEach(rootRef => __InsertNodeToElementTemplate(root, 0, rootRef, null));

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
