import { __OpBegin, __OpEnd, __OpSlot, renderOpcodesIntoElementTemplate, runCase } from '../_shared.js';

export function run() {
  return runCase(({ root, nativeLog }) => {
    const opcodes = [
      __OpBegin,
      { type: '_et_parent', props: {} },
      __OpSlot,
      0,
      __OpBegin,
      { type: '_et_child_a', props: {} },
      __OpEnd,
      __OpBegin,
      { type: '_et_child_b', props: {} },
      __OpEnd,
      __OpEnd,
    ];

    const { rootRefs } = renderOpcodesIntoElementTemplate(opcodes);
    rootRefs.forEach(rootRef => __AppendElement(root as FiberElement, rootRef));

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
