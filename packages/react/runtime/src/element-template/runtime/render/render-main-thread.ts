// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements the IFR (Instant First-Frame Rendering) on main thread.
 */

import { renderOpcodesIntoElementTemplate } from './render-opcodes.js';
import { render as renderToString } from './render-to-opcodes.js';
import { profileEnd, profileStart } from '../../debug/profile.js';
import { ElementTemplateLifecycleConstant } from '../../protocol/lifecycle-constant.js';
import type { SerializedElementTemplate } from '../../protocol/types.js';
import { __page } from '../page/page.js';
import { __root } from '../page/root-instance.js';

function renderMainThread(): void {
  let opcodes;
  let rootRefs: ElementRef[] = [];
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
    rootRefs = renderOpcodesIntoElementTemplate(opcodes).rootRefs;
    for (const rootRef of rootRefs) {
      __AppendElement(__page, rootRef);
    }
  } finally {
    profileEnd();
  }

  profileStart('ReactLynx::packSerializedETInstance');
  try {
    const instances: SerializedElementTemplate[] = [];
    for (const rootRef of rootRefs) {
      instances.push(__SerializeElementTemplate(rootRef) as SerializedElementTemplate);
    }

    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: instances,
    });
  } finally {
    profileEnd();
  }
}

export { renderMainThread };
