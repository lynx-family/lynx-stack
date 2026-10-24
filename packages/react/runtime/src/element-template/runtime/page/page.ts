// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ELEMENT_TEMPLATE_PAGE_HANDLE_ID, ELEMENT_TEMPLATE_PAGE_TYPE } from '../../protocol/page.js';

export let __page: ElementTemplateHandle;

export function createElementTemplatePage(): ElementTemplateHandle {
  return __CreateTypedElementTemplate(
    ELEMENT_TEMPLATE_PAGE_TYPE,
    null,
    null,
    ELEMENT_TEMPLATE_PAGE_HANDLE_ID,
    null,
  );
}

export function setupPage(page: ElementTemplateHandle): void {
  __page = page;
}
