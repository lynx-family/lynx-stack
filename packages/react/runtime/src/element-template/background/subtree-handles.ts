// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BackgroundElementTemplateInstance } from './shadow-instance.js';
import { ELEMENT_TEMPLATE_PAGE_HANDLE_ID } from '../protocol/page.js';
import { hasMainThreadRefAttrSlot } from '../runtime/template/attr-slot-plan.js';

export function collectElementTemplateSubtreeHandleIds(
  root: BackgroundElementTemplateInstance,
): number[] {
  const handles: number[] = [];
  collectElementTemplateSubtreeHandleIdsImpl(root, handles);
  return handles;
}

export function collectMainThreadRefSubtreeHandleIds(
  root: BackgroundElementTemplateInstance,
): number[] | null {
  return collectMainThreadRefSubtreeHandleIdsImpl(root, null);
}

function collectMainThreadRefSubtreeHandleIdsImpl(
  instance: BackgroundElementTemplateInstance,
  handles: number[] | null,
): number[] | null {
  if (hasMainThreadRefAttrSlot(instance.type)) {
    handles ??= [];
    handles.push(instance.instanceId);
  }
  let child = instance.firstChild;
  while (child) {
    handles = collectMainThreadRefSubtreeHandleIdsImpl(child, handles);
    child = child.nextSibling;
  }
  return handles;
}

function collectElementTemplateSubtreeHandleIdsImpl(
  instance: BackgroundElementTemplateInstance,
  handles: number[],
): void {
  if (instance.instanceId !== ELEMENT_TEMPLATE_PAGE_HANDLE_ID) {
    handles.push(instance.instanceId);
  }
  let child = instance.firstChild;
  while (child) {
    collectElementTemplateSubtreeHandleIdsImpl(child, handles);
    child = child.nextSibling;
  }
}
