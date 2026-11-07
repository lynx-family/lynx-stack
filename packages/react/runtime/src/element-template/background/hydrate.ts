// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { hydrateListInstance } from './hydrate-list.js';
import {
  arePairwiseHydrateKeysEqual,
  clearHydrateKeyCache,
  diffHydrateSlotChildren,
  isSerializedCompiledNode,
  isSerializedTypedListNode,
} from './hydrate-matcher.js';
import {
  bindHydrationHandleId,
  emitHydrateSlotDiffPatches,
  emitSerializedSubtreeRemove,
  hydrateAttributeSlots,
} from './hydrate-patch.js';
import { BUILTIN_RAW_TEXT_TEMPLATE_KEY } from './shadow-instance.js';
import type { BackgroundElementTemplateInstance } from './shadow-instance.js';
import type { BackgroundListElementTemplateInstance } from './typed-instance.js';
import { ELEMENT_TEMPLATE_PAGE_HANDLE_ID, ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX } from '../protocol/page.js';
import type { SerializedCompiledNode, SerializedEtNode, SerializedTypedListNode } from '../protocol/types.js';

export function hydrateRootChildrenIntoContext(
  serializedChildren: SerializedEtNode[],
  root: BackgroundElementTemplateInstance,
): boolean {
  try {
    return hydrateChildListIntoContext(
      ELEMENT_TEMPLATE_PAGE_HANDLE_ID,
      ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX,
      serializedChildren,
      root.childNodes,
    );
  } finally {
    // Template identities only need caching for this synchronous hydration pass.
    clearHydrateKeyCache();
  }
}

function hydrateInstance(
  serialized: SerializedEtNode,
  instance: BackgroundElementTemplateInstance,
): boolean {
  if (isSerializedCompiledNode(serialized)) {
    return hydrateCompiledInstance(serialized, instance);
  }
  if (__DEV__ && !isSerializedTypedListNode(serialized)) {
    lynx.reportError(
      new Error(`ElementTemplate hydrate does not support serialized typed node '${serialized.tag}'.`),
    );
    return false;
  }
  return hydrateListInstance(
    serialized as SerializedTypedListNode,
    instance as BackgroundListElementTemplateInstance,
    hydrateInstance,
  );
}

function hydrateCompiledInstance(
  serialized: SerializedCompiledNode,
  instance: BackgroundElementTemplateInstance,
): boolean {
  const handleId = serialized.uid;
  if (!bindHydrationHandleId(instance, handleId, serialized.templateKey)) {
    return false;
  }
  if (serialized.attributeSlots?.length || instance.attributeSlots.length) {
    instance.prepareAttributeSlotsForHydration();
    hydrateAttributeSlots(instance.type, handleId, serialized.attributeSlots ?? [], instance.attributeSlots);
  }

  if (serialized.templateKey === BUILTIN_RAW_TEXT_TEMPLATE_KEY) {
    return true;
  }

  if (!serialized.childSlots?.length && !instance.firstChild) {
    return true;
  }

  const serializedChildSlots = serialized.childSlots ?? [];
  const backgroundChildSlots = instance.childSlots;
  // Snapshot hydrates dynamic children through slot-filtered lists. Keeping ET
  // scoped the same way means a cross-slot candidate is a source remove plus a
  // target create/insert, while same-slot reorder can still stay move-like.
  const slotCount = Math.max(serializedChildSlots.length, backgroundChildSlots.length);
  for (let slotId = 0; slotId < slotCount; slotId += 1) {
    const serializedSlot = serializedChildSlots[slotId];
    const backgroundSlot = backgroundChildSlots[slotId];
    if (!serializedSlot && !backgroundSlot) {
      continue;
    }
    if (
      !hydrateChildListIntoContext(
        instance.instanceId,
        slotId,
        serializedSlot ?? [],
        backgroundSlot ?? [],
      )
    ) {
      return false;
    }
  }
  return true;
}

function hydrateChildListIntoContext(
  targetHandleId: number,
  slotId: number,
  serializedChildren: SerializedEtNode[],
  backgroundChildren: BackgroundElementTemplateInstance[],
): boolean {
  if (backgroundChildren.length === 0) {
    for (const serialized of serializedChildren) {
      if (!emitSerializedSubtreeRemove(targetHandleId, slotId, serialized)) {
        return false;
      }
    }
    return true;
  }

  // Preserve the full matcher’s FIFO pairing while avoiding its temporary
  // structures when every child already occupies the matching slot position.
  if (arePairwiseHydrateKeysEqual(serializedChildren, backgroundChildren)) {
    for (let i = 0; i < serializedChildren.length; i += 1) {
      if (!hydrateInstance(serializedChildren[i]!, backgroundChildren[i]!)) {
        return false;
      }
    }
    return true;
  }

  const listDiff = diffHydrateSlotChildren(serializedChildren, backgroundChildren, hydrateInstance);
  if (listDiff === null) {
    return false;
  }

  return emitHydrateSlotDiffPatches(targetHandleId, slotId, serializedChildren, listDiff);
}
