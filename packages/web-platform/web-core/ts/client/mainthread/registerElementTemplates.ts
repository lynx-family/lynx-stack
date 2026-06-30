/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type {
  DecodedElementTemplateDefinition,
  DecodedTemplate,
  ElementTemplateElementNode,
} from '../../types/index.js';
import {
  cssIdAttribute,
  elementTemplateSlotAnchorPrefix,
  LYNX_TAG_TO_HTML_TAG_MAP,
} from '../../constants.js';
import { wasmInstance } from '../wasm.js';

export function ensureElementTemplateDefinitions(
  bundle: DecodedTemplate | undefined,
  transformStyle: (style: string) => string,
) {
  if (!bundle?.elementTemplates) {
    return;
  }
  const definitions = bundle.elementTemplateDefinitions ??= new Map<
    string,
    DecodedElementTemplateDefinition
  >();

  for (const { templateId, compiledTemplate } of bundle.elementTemplates) {
    if (definitions.has(templateId)) {
      continue;
    }

    const template = document.createElement('template');
    const definition = new wasmInstance.ElementTemplateDefinition();
    let nextElementIndex = 0;
    const stack: Array<
      | {
        kind: 'element';
        node: ElementTemplateElementNode;
        parent?: HTMLElement;
      }
      | {
        kind: 'slot';
        slotIndex: number;
        parent: HTMLElement;
      }
    > = [{ kind: 'element', node: compiledTemplate }];

    while (stack.length > 0) {
      const action = stack.pop()!;
      if (action.kind === 'slot') {
        action.parent.appendChild(
          document.createComment(
            `${elementTemplateSlotAnchorPrefix}${action.slotIndex}`,
          ),
        );
        continue;
      }

      const elementIndex = nextElementIndex++;
      const element = document.createElement(
        LYNX_TAG_TO_HTML_TAG_MAP[action.node.type] ?? action.node.type,
      );

      for (const attribute of action.node.attributesArray ?? []) {
        switch (attribute.kind) {
          case 'static':
            {
              if (
                attribute.key === 'css-id'
                && (attribute.value == null || Number(attribute.value) === 0)
              ) {
                break;
              }
              const key = attribute.key === 'css-id'
                ? cssIdAttribute
                : attribute.key === 'className'
                ? 'class'
                : attribute.key;
              const value = attribute.value == null
                ? undefined
                : key === 'style'
                ? transformStyle(String(attribute.value))
                : String(attribute.value);
              definition.add_static_binding(elementIndex, attribute.key, value);
              if (value == null) {
                element.removeAttribute(key);
              } else {
                element.setAttribute(key, value);
              }
            }
            break;
          case 'slot':
            definition.add_attribute_binding(
              elementIndex,
              attribute.attrSlotIndex,
              attribute.key,
            );
            break;
          case 'spread':
            definition.add_spread_binding(
              elementIndex,
              attribute.attrSlotIndex,
            );
            break;
        }
      }

      if (action.parent) {
        action.parent.appendChild(element);
      } else {
        template.content.appendChild(element);
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
              parent: element,
            });
          } else {
            stack.push({
              kind: 'element',
              node: child,
              parent: element,
            });
          }
        }
      }
    }

    definitions.set(templateId, {
      template,
      definition,
    });
  }
}
