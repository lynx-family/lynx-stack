/*
Copyright 2025 The Lynx Authors. All rights reserved.
Licensed under the Apache License Version 2.0 that can be found in the
LICENSE file in the root directory of this source tree.
*/
import type { ElementTemplateData } from '../types/index.js';
import {
  ElementTemplateSection,
  RawElementTemplate,
  // @ts-ignore
} from '../../binary/encode/encode.js';

export function encodeElementTemplates(
  elementTemplates: Record<string, ElementTemplateData>,
): Uint8Array {
  const elementTemplateSection = new ElementTemplateSection();
  for (const [key, templateData] of Object.entries(elementTemplates)) {
    let uniqueId = 1;
    const elementTemplate = new RawElementTemplate();

    function createEncodeOneElementTemplateData(data: ElementTemplateData) {
      const currentId = uniqueId;
      elementTemplate.create_element(
        data.type,
        uniqueId,
      );
      uniqueId += 1;
      if (data.attributes) {
        for (const [attrKey, attrValue] of Object.entries(data.attributes)) {
          elementTemplate.set_attribute(currentId, attrKey, attrValue);
        }
      }
      if (data.builtinAttributes) {
        for (
          const [attrKey, attrValue] of Object.entries(data.builtinAttributes)
        ) {
          elementTemplate.set_attribute(currentId, attrKey, attrValue);
        }
      }
      if (data.class) {
        elementTemplate.set_attribute(
          currentId,
          'class',
          data.class.join(' '),
        );
      }
      if (data.dataset) {
        for (const [dataKey, dataValue] of Object.entries(data.dataset)) {
          elementTemplate.set_dataset(currentId, dataKey, dataValue);
        }
      }
      if (data.events) {
        for (const event of data.events) {
          elementTemplate.set_cross_thread_event(
            currentId,
            event.type,
            event.name,
            event.value,
          );
        }
      }
      if (data.idSelector) {
        elementTemplate.set_attribute(
          currentId,
          'id',
          data.idSelector,
        );
      }
      if (data.children) {
        for (const child of data.children) {
          const childId = createEncodeOneElementTemplateData(child);
          elementTemplate.append_child(currentId, childId);
        }
      }
      return currentId;
    }

    elementTemplate.append_to_root(
      createEncodeOneElementTemplateData(templateData),
    );
    elementTemplateSection.add_element_template(key, elementTemplate);
  }
  return elementTemplateSection.encode();
}
