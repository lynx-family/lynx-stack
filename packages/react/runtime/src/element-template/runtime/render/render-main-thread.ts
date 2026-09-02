// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements the IFR (Instant First-Frame Rendering) on main thread.
 */

import { renderOpcodesIntoElementTemplate } from './render-opcodes.js';
import { render as renderToString } from './render-to-opcodes.js';
import { getReloadVersion } from '../../../core/reload-version.js';
import { profileEnd, profileStart } from '../../debug/profile.js';
import { ElementTemplateLifecycleConstant } from '../../protocol/lifecycle-constant.js';
import { ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX } from '../../protocol/page.js';
import type { ElementTemplateHydrateCommitContext, SerializedPageRoot } from '../../protocol/types.js';
import { flushInitialElementTemplateListUpdates } from '../list/list.js';
import { __page } from '../page/page.js';
import { __root } from '../page/root-instance.js';
import { insertElementTemplateSubtree } from '../template/handle.js';
import { getElementTemplateNativeRef } from '../template/registry.js';
import { TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX } from '../template/typed-attributes.js';

function renderMainThread(): void {
  let opcodes;
  profileStart('ReactLynx::renderMainThread');
  try {
    opcodes = renderToString(__root.__jsx, undefined);
  } catch (e) {
    lynx.reportError(e as Error);
    opcodes = [];
  } finally {
    profileEnd();
  }

  profileStart('ReactLynx::renderOpcodes');
  try {
    const { pageAttributes, rootRefs, rootSubtreeHandles } = renderOpcodesIntoElementTemplate(opcodes);
    __SetAttributeOfElementTemplate(__page, TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX, pageAttributes, null);
    for (let index = 0; index < rootRefs.length; index += 1) {
      const rootRef = rootRefs[index]!;
      insertElementTemplateSubtree(
        __page,
        ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX,
        rootRef,
        null,
        rootSubtreeHandles[index]!,
      );
    }
    flushInitialListUpdates();
  } finally {
    profileEnd();
  }

  profileStart('ReactLynx::packSerializedETInstance');
  try {
    const payload: ElementTemplateHydrateCommitContext = {
      page: __SerializeElementTemplate(__page) as SerializedPageRoot,
      reloadVersion: getReloadVersion(),
    };

    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: payload,
    });
  } finally {
    profileEnd();
  }
}

function flushInitialListUpdates(): void {
  const results = flushInitialElementTemplateListUpdates();
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index]!;
    const listRef = getElementTemplateNativeRef(result.uid);
    if (listRef) {
      __SetAttributeOfElementTemplate(listRef, TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX, result.attributes, null);
    }
  }
}

export { renderMainThread };
