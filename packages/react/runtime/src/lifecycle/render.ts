// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements the IFR (Instant First-Frame Rendering) on main thread.
 */

import { profileEnd, profileStart } from '../debug/profile.js';
import { render as renderToString } from '../renderToOpcodes/index.js';
import { __root } from '../root.js';
import { SnapshotInstance } from '../snapshot/snapshot.js';

function renderMainThread(): void {
  let opcodes;
  try {
    if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
      profileStart('ReactLynx::renderMainThread');
    }
    opcodes = renderToString(__root.__jsx, undefined, __root as SnapshotInstance);
  } catch (e) {
    lynx.reportError(e as Error);
    opcodes = [];
    (__root as SnapshotInstance).removeChildren();
  } finally {
    if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
      profileEnd();
    }
  }

  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::renderOpcodes');
  }
  if (__ENABLE_SSR__) {
    __root.__opcodes = opcodes;
  }
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileEnd();
  }
}

export { renderMainThread };
