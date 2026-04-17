// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const templateRepo = new Map<string, any>();

export const BUILTIN_RAW_TEXT_TEMPLATE_ID = '__et_builtin_raw_text__';

const builtinRawTextTemplate = {
  templateId: BUILTIN_RAW_TEXT_TEMPLATE_ID,
  compiledTemplate: {
    kind: 'element',
    tag: 'raw-text',
    attributesArray: [
      {
        kind: 'attribute',
        key: 'text',
        binding: 'slot',
        attrSlotIndex: 0,
      },
    ],
    children: [],
  },
};

export function registerBuiltinRawTextTemplate(): void {
  if (!templateRepo.has(BUILTIN_RAW_TEXT_TEMPLATE_ID)) {
    templateRepo.set(
      builtinRawTextTemplate.templateId,
      builtinRawTextTemplate.compiledTemplate,
    );
  }
}

export function registerTemplates(templates: any[]): void {
  for (const t of templates) {
    // The key is templateId, value is compiledTemplate
    templateRepo.set(t.templateId, t.compiledTemplate);
  }
}

export function clearTemplates(): void {
  templateRepo.clear();
}
