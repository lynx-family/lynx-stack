// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { hydrateRootChildrenIntoContext } from './hydrate.js';
import type { BackgroundPageRootInstance } from './instance.js';
import { ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX } from '../protocol/page.js';
import type { SerializedPageRoot } from '../protocol/types.js';

export function hydratePageRootIntoContext(
  page: SerializedPageRoot,
  root: BackgroundPageRootInstance,
): boolean {
  const didHydrateChildren = hydrateRootChildrenIntoContext(
    page.childSlots?.[ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX] ?? [],
    root,
  );
  if (!didHydrateChildren) {
    return false;
  }
  root.reconcileAuthoredPageAttributesOnHydration(page.attributes ?? null);
  return true;
}
