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
import type { ElementTemplateHydrateCommitContext, SerializedEtNode } from '../../protocol/types.js';
import { __page } from '../page/page.js';
import { __root } from '../page/root-instance.js';

// ET reload reuses the native page, so the main-thread render path owns the
// root refs it appended and can remove only those roots before rebuilding.
let mainThreadRootRefs: ElementRef[] = [];

function resetMainThreadRootRefs(): void {
  mainThreadRootRefs = [];
}

function removeMainThreadRootRefs(): void {
  const rootRefs = mainThreadRootRefs;
  mainThreadRootRefs = [];
  for (const rootRef of rootRefs) {
    __RemoveElement(__page, rootRef);
  }
}

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
    const { rootRefs } = renderOpcodesIntoElementTemplate(opcodes);
    for (const rootRef of rootRefs) {
      __AppendElement(__page, rootRef);
    }
    mainThreadRootRefs = rootRefs;
  } finally {
    profileEnd();
  }

  profileStart('ReactLynx::packSerializedETInstance');
  try {
    const instances: SerializedEtNode[] = [];
    for (const rootRef of mainThreadRootRefs) {
      instances.push(__SerializeElementTemplate(rootRef));
    }
    const payload: ElementTemplateHydrateCommitContext = {
      instances,
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

export { removeMainThreadRootRefs, renderMainThread, resetMainThreadRootRefs };
