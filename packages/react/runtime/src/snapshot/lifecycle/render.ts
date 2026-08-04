// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements the IFR (Instant First-Frame Rendering) on main thread.
 */

import { __root } from '../../root.js';
import { profileEnd, profileStart } from '../../shared/profile.js';
import { render as renderToString } from '../renderToOpcodes/index.js';
import { SnapshotInstance } from '../snapshot/snapshot.js';

/**
 * What the main thread paints when it does *not* render the whole tree —
 * the assembled main-thread bundle of `enableMTSRendering: false` installs it
 * (see `runtime/mts-rendering-disabled/`).
 *
 * It runs from {@link renderMainThread}, i.e. inside `renderPage` after the
 * page element and `__root`'s elements exist, and not at module scope: the
 * island's component only becomes reachable once the entry chunk's *later*
 * entry modules — the ones the build adds for the island — have run.
 */
let mainThreadFirstFrame: (() => void) | undefined;

/**
 * @internal
 */
function setMainThreadFirstFrame(render: () => void): void {
  mainThreadFirstFrame = render;
}

function renderMainThread(): void {
  if (!__ENABLE_MTS_RENDERING__) {
    if (mainThreadFirstFrame) {
      try {
        mainThreadFirstFrame();
      } catch (e) {
        lynx.reportError(e as Error);
        (__root as SnapshotInstance).removeChildren();
      }
    }
    return;
  }

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

  if (__ENABLE_SSR__) {
    __root.__opcodes = opcodes;
  }
}

export { renderMainThread, setMainThreadFirstFrame };
