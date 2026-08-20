// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  ELEMENT_TEMPLATE_PAGE_HANDLE_ID,
  ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX,
  ELEMENT_TEMPLATE_PAGE_TYPE,
} from '../../protocol/page.js';

export let __page: ElementRef;

export function createElementTemplatePage(): ElementRef {
  return __CreateTypedElementTemplate(
    ELEMENT_TEMPLATE_PAGE_TYPE,
    null,
    null,
    String(ELEMENT_TEMPLATE_PAGE_HANDLE_ID),
    null,
  );
}

export function setupPage(page: ElementRef): void {
  __page = page;
}

export function insertRootIntoPage(rootRef: ElementRef): void {
  __InsertNodeToElementTemplate(__page, ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX, rootRef, null);
}

export function removeRootFromPage(rootRef: ElementRef): void {
  __RemoveNodeFromElementTemplate(__page, ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX, rootRef);
}
