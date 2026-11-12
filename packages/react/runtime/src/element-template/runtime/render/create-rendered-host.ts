// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ElementTemplateHost } from './host.js';
import {
  MAIN_BUNDLE_URL_SENTINEL,
  elementTemplateIdentityKey,
  parseElementTemplateType,
} from '../../protocol/template-type.js';
import type { RuntimeTypedElementAttributes, SerializableValue } from '../../protocol/types.js';
import {
  composeElementTemplateListAttributes,
  createElementTemplateListState,
  markElementTemplateListDestroyed,
  registerElementTemplateListItem,
  registerElementTemplateListState,
} from '../list/list.js';
import type { ETListItemPlatformInfo } from '../list/list.js';
import { __etAttrPlanMap, hasMainThreadRefAttrSlot } from '../template/attr-slot-plan.js';
import type { EtAttrAdapter } from '../template/attr-slot-plan.js';
import {
  createElementTemplateWithReservedHandle,
  createTypedElementTemplateWithReservedHandle,
  destroyElementTemplateId,
  getNextElementTemplateId,
} from '../template/handle.js';
import type { MainThreadDynamicAttrSubtreeHandle } from '../template/main-thread-dynamic-attr-state.js';
import { prepareTypedElementAttributes } from '../template/typed-attributes.js';

const TYPED_LIST_HOST_TYPE = 'list';
const EMPTY_LIST_ITEM_UIDS: readonly number[] = [];

export type RenderAttributes = SerializableValue[] | RuntimeTypedElementAttributes | undefined;

export function discardRenderedHostsSince(checkpoint: number): void {
  const end = getNextElementTemplateId();
  // Synchronous first-screen creation allocates consecutive negative IDs.
  // Release abandoned native refs and side tables without reusing those IDs.
  for (let uid = checkpoint; uid > end; uid--) {
    markElementTemplateListDestroyed(uid);
    destroyElementTemplateId(uid);
  }
}

export function createRenderedHost(
  handleId: number,
  type: string,
  attributes: RenderAttributes,
  childSlots: ElementTemplateHandle[][] | undefined,
  listItemUids: number[] | undefined,
  materializationHandles: MainThreadDynamicAttrSubtreeHandle[],
  listItemPlatformInfo: ETListItemPlatformInfo | undefined,
  host?: ElementTemplateHost,
): ElementTemplateHandle {
  if (type === TYPED_LIST_HOST_TYPE) {
    // TODO: Support main-thread events on List.
    const preparedTypedAttributes = prepareTypedElementAttributes(
      handleId,
      attributes as RuntimeTypedElementAttributes | undefined,
    );
    const listState = createElementTemplateListState(
      listItemUids ?? EMPTY_LIST_ITEM_UIDS,
      preparedTypedAttributes,
    );
    const attrsWithCallbacks = composeElementTemplateListAttributes(
      undefined,
      listState,
    );
    const elementRef = createTypedElementTemplateWithReservedHandle(
      handleId,
      TYPED_LIST_HOST_TYPE,
      attrsWithCallbacks,
      childSlots ?? null,
      {},
    );
    // Native records initial items from childSlots, so skip the initial JS
    // insert flush.
    registerElementTemplateListState(handleId, listState, false, elementRef);
    return elementRef;
  }

  const plain = host?.plain === true;
  const attrPlan = plain ? undefined : __etAttrPlanMap[type];
  const attributeSlots = attributes as SerializableValue[] | undefined;
  let preparedAttributeSlots = attributeSlots ?? null;
  if (attrPlan !== undefined) {
    preparedAttributeSlots = attributeSlots?.slice() ?? [];
    for (let planIndex = 0; planIndex < attrPlan.length; planIndex += 2) {
      const attrSlotIndex = attrPlan[planIndex] as number;
      const adapter = attrPlan[planIndex + 1] as EtAttrAdapter;
      preparedAttributeSlots[attrSlotIndex] = adapter(
        handleId,
        attrSlotIndex,
        preparedAttributeSlots[attrSlotIndex],
      );
    }
  }
  // Compact hosts carry bundle identity captured when their template is defined.
  const identity = host ?? parseElementTemplateType(type);
  const templateKey = identity.templateKey;
  const bundleUrl = identity.bundleUrl === MAIN_BUNDLE_URL_SENTINEL ? null : identity.bundleUrl;
  const hasMainThreadRef = !plain && /* #__NOINLINE__ */ hasMainThreadRefAttrSlot(type);
  const elementRef = createElementTemplateWithReservedHandle(
    handleId,
    templateKey,
    bundleUrl,
    preparedAttributeSlots,
    childSlots ?? null,
    !plain,
    // Pass List item platform info through native ET options during initial
    // rendering.
    listItemPlatformInfo === undefined
      ? undefined
      : { __listItemPlatformInfo: listItemPlatformInfo },
  );
  if (hasMainThreadRef) {
    materializationHandles.push({
      uid: handleId,
      ref: elementRef,
    });
  }
  if (listItemPlatformInfo !== undefined) {
    registerElementTemplateListItem(handleId, elementRef, {
      // The native list identifies items by the same identity the template
      // was registered under (sentinel stripped for the main card), so the
      // update path (`resolveTypedListItem`) stays consistent with it.
      templateKey: elementTemplateIdentityKey(templateKey, bundleUrl),
      platformInfo: listItemPlatformInfo,
    });
  }
  return elementRef;
}
