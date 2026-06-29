/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type {
  ElementTemplateAsset,
  ElementTemplateElementNode,
} from '../../types/index.js';
import type { MainThreadWasmContext } from '../wasm.js';

export function registerElementTemplates(
  wasmContext: InstanceType<MainThreadWasmContext>,
  elementTemplates: ElementTemplateAsset[] | undefined,
  bundleUrl?: string,
) {
  for (const { templateId, compiledTemplate } of elementTemplates ?? []) {
    const definition = wasmContext.create_element_template_definition(
      templateId,
      bundleUrl,
    );
    const stack: Array<
      | {
        kind: 'element';
        node: ElementTemplateElementNode;
        parentIndex?: number;
      }
      | {
        kind: 'slot';
        slotIndex: number;
        parentIndex: number;
      }
    > = [{ kind: 'element', node: compiledTemplate }];

    while (stack.length > 0) {
      const action = stack.pop()!;
      if (action.kind === 'slot') {
        definition.append_slot(action.parentIndex, action.slotIndex);
        continue;
      }

      const elementIndex = action.parentIndex === undefined
        ? definition.append_root(action.node.type)
        : definition.append_child(action.parentIndex, action.node.type);
      for (const attribute of action.node.attributesArray ?? []) {
        switch (attribute.kind) {
          case 'static':
            definition.push_static_attribute(
              elementIndex,
              attribute.key,
              attribute.value,
            );
            break;
          case 'slot':
            definition.push_slot_attribute(
              elementIndex,
              attribute.key,
              attribute.attrSlotIndex,
            );
            break;
          case 'spread':
            definition.push_spread_attribute(
              elementIndex,
              attribute.attrSlotIndex,
            );
            break;
        }
      }

      // Push in reverse so the LIFO traversal appends children in template order.
      const children = action.node.children;
      if (children) {
        for (let index = children.length - 1; index >= 0; index--) {
          const child = children[index]!;
          if (child.kind === 'elementSlot') {
            stack.push({
              kind: 'slot',
              slotIndex: child.elementSlotIndex,
              parentIndex: elementIndex,
            });
          } else {
            stack.push({
              kind: 'element',
              node: child,
              parentIndex: elementIndex,
            });
          }
        }
      }
    }

    wasmContext.register_element_template(definition);
  }
}
