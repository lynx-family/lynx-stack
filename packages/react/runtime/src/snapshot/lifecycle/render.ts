// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements the IFR (Instant First-Frame Rendering) on main thread.
 */

import { __root } from '../../root.js';
import { profileEnd, profileStart } from '../../shared/profile.js';
import { SnapshotInstance } from '../snapshot/snapshot.js';

type RenderToString = (
  jsx: unknown,
  context: undefined,
  root: SnapshotInstance,
) => unknown[];

// Injected by `lynx.ts` rather than imported: the renderer pulls in `preact`,
// which a main thread that renders no business code must not link.
let renderToString: RenderToString | undefined;

function setMainThreadRenderer(render: RenderToString): void {
  renderToString = render;
}

function renderMainThread(): void {
  if (!__ENABLE_MTS_RENDERING__ || !renderToString) {
    // The main thread has no business code to render; the background hydrates
    // the empty root and sends a full insert patch instead.
    return;
  }

  let opcodes: unknown[];
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

export { renderMainThread, setMainThreadRenderer };
