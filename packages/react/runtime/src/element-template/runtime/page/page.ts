// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export let __page: ElementTemplateHandle;

const ELEMENT_TEMPLATE_PAGE_TYPE = 'page';
const ELEMENT_TEMPLATE_PAGE_UID = 0;
const ELEMENT_TEMPLATE_PAGE_ROOT_SLOT = 0;

export function createElementTemplatePage(): ElementTemplateHandle {
  return __CreateTypedElementTemplate(ELEMENT_TEMPLATE_PAGE_TYPE, null, null, ELEMENT_TEMPLATE_PAGE_UID, null);
}

export function setupPage(page: ElementTemplateHandle): void {
  __page = page;
}

export function insertRootIntoPage(rootRef: ElementTemplateHandle): void {
  __InsertNodeToElementTemplate(__page, ELEMENT_TEMPLATE_PAGE_ROOT_SLOT, rootRef, null);
}

export function removeRootFromPage(rootRef: ElementTemplateHandle): void {
  __RemoveNodeFromElementTemplate(__page, ELEMENT_TEMPLATE_PAGE_ROOT_SLOT, rootRef);
}
