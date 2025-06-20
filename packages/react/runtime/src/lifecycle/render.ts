// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements the IFR (Instant First-Frame Rendering) on main thread.
 */

import { render } from 'preact';

import { renderOpcodesInto } from '../opcodes.js';
import { render as renderToString } from '../renderToOpcodes/index.js';
import { __root } from '../root.js';

function renderMainThread(): void {
  /* v8 ignore start */
  if (
    process.env['NODE_ENV'] === 'test' && typeof __TESTING_FORCE_RENDER_TO_OPCODE__ !== 'undefined'
    && !__TESTING_FORCE_RENDER_TO_OPCODE__
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    render(__root.__jsx, __root as any);
  } else {
    let opcodes;
    try {
      if (__PROFILE__) {
        console.profile('renderToString');
      }
      opcodes = renderToString(__root.__jsx, undefined);
    } catch (e) {
      lynx.reportError(e as Error);
      opcodes = [];
    } finally {
      if (__PROFILE__) {
        console.profileEnd();
      }
    }

    if (__PROFILE__) {
      console.profile('renderOpcodesInto');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    renderOpcodesInto(opcodes, __root as any);
    if (__ENABLE_SSR__) {
      __root.__opcodes = opcodes;
    }
    if (__PROFILE__) {
      console.profileEnd();
    }
  }
  /* v8 ignore stop */
}

export { renderMainThread };
