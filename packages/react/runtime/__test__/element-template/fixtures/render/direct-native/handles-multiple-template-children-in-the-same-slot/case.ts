import { h } from 'preact';
import { renderToElementTemplate, runCase } from '../_shared.js';

export function run() {
  return runCase(({ root, nativeLog }) => {
    const { rootRefs } = renderToElementTemplate(h('_et_parent', { $0: [h('_et_child_a', {}), h('_et_child_b', {})] }));
    rootRefs.forEach(rootRef => __InsertNodeToElementTemplate(root, 0, rootRef, null));

    const slotChildren = root.children?.[0]?.children?.[0]?.children ?? [];
    return {
      output: {
        slotChildrenCount: slotChildren.length,
        slotChildrenTags: slotChildren.map((child: { tag?: string }) => child.tag ?? null),
        slotChildrenTemplateIds: slotChildren.map((child: { templateId?: string }) => child.templateId ?? null),
      },
      files: {
        'native-log.txt': nativeLog,
      },
    };
  });
}
