/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type {
  ElementTemplateAsset,
  ElementTemplateElementNode,
} from '../../types/index.js';
import { cssIdAttribute, LYNX_TAG_TO_HTML_TAG_MAP } from '../../constants.js';
import type { MainThreadWasmContext } from '../wasm.js';

export const elementTemplateSlotAnchorPrefix = 'lynx-et-slot:';

export type RegisteredElementTemplate = {
  template: HTMLTemplateElement;
  maxAttributeSlotIndex: number;
};

const elementTemplateRegistry = new WeakMap<
  InstanceType<MainThreadWasmContext>,
  Map<string, RegisteredElementTemplate>
>();

export function getElementTemplateIdentityKey(
  templateKey: string,
  bundleUrl?: string | null,
) {
  return bundleUrl && bundleUrl !== '__Card__'
    ? `${bundleUrl}:${templateKey}`
    : templateKey;
}

export function getRegisteredElementTemplate(
  wasmContext: InstanceType<MainThreadWasmContext>,
  templateKey: string,
  bundleUrl?: string | null,
) {
  return elementTemplateRegistry.get(wasmContext)?.get(
    getElementTemplateIdentityKey(templateKey, bundleUrl),
  );
}

export function registerElementTemplates(
  wasmContext: InstanceType<MainThreadWasmContext>,
  elementTemplates: ElementTemplateAsset[] | undefined,
  bundleUrl?: string,
) {
  let registry = elementTemplateRegistry.get(wasmContext);
  if (!registry) {
    registry = new Map();
    elementTemplateRegistry.set(wasmContext, registry);
  }

  for (const { templateId, compiledTemplate } of elementTemplates ?? []) {
    const template = document.createElement('template');
    const definitionId = wasmContext.create_element_template_definition(
      templateId,
      bundleUrl,
    );
    let nextElementIndex = 0;
    let maxAttributeSlotIndex = -1;
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
      if (action.parent) {
        action.parent.appendChild(element);
      } else {
        template.content.appendChild(element);
      }

      for (const attribute of action.node.attributesArray ?? []) {
        switch (attribute.kind) {
          case 'static':
            switch (typeof attribute.value) {
              case 'string':
                wasmContext.add_element_template_static_string_binding(
                  definitionId,
                  elementIndex,
                  attribute.key,
                  attribute.value,
                );
                break;
              case 'number':
                wasmContext.add_element_template_static_number_binding(
                  definitionId,
                  elementIndex,
                  attribute.key,
                  attribute.value,
                );
                break;
              case 'boolean':
                wasmContext.add_element_template_static_bool_binding(
                  definitionId,
                  elementIndex,
                  attribute.key,
                  attribute.value,
                );
                break;
              default:
                wasmContext.add_element_template_static_null_binding(
                  definitionId,
                  elementIndex,
                  attribute.key,
                );
                break;
            }

            {
              const key = attribute.key === 'css-id'
                ? cssIdAttribute
                : attribute.key === 'className'
                ? 'class'
                : attribute.key;
              if (key === 'style') {
                if (attribute.value == null) {
                  element.removeAttribute(key);
                } else {
                  element.setAttribute(
                    key,
                    wasmContext.transform_element_template_style(
                      String(attribute.value),
                    ),
                  );
                }
                break;
              }
              if (attribute.value == null) {
                element.removeAttribute(key);
              } else {
                element.setAttribute(key, String(attribute.value));
                if (key === 'text') {
                  switch (element.tagName.toLowerCase()) {
                    case 'x-text':
                    case 'raw-text':
                      for (const child of Array.from(element.childNodes)) {
                        if (child.nodeType === 3) {
                          child.remove();
                        }
                      }
                      break;
                  }
                }
              }
            }
            break;
          case 'slot':
            maxAttributeSlotIndex = Math.max(
              maxAttributeSlotIndex,
              attribute.attrSlotIndex,
            );
            wasmContext.add_element_template_attribute_binding(
              definitionId,
              elementIndex,
              attribute.attrSlotIndex,
              attribute.key,
            );
            break;
          case 'spread':
            maxAttributeSlotIndex = Math.max(
              maxAttributeSlotIndex,
              attribute.attrSlotIndex,
            );
            wasmContext.add_element_template_spread_binding(
              definitionId,
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

    wasmContext.finish_element_template_definition(definitionId);
    registry.set(getElementTemplateIdentityKey(templateId, bundleUrl), {
      template,
      maxAttributeSlotIndex,
    });
  }
}
