// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements the IFR (Instant First-Frame Rendering) on main thread.
 */

import { isValidElement } from 'preact';

import { renderOpcodesInto } from '../opcodes.js';
import { render as renderToString } from '../renderToOpcodes/index.js';
import { __root } from '../root.js';
import { SnapshotInstance } from '../snapshot.js';

function renderMainThread(): void {
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

  if (process.env['NODE_ENV'] === 'test') {
    opcodes = opcodes.map((opcode) => {
      if (isValidElement(opcode) && typeof opcode.type === 'string') {
        return Object.assign(new SnapshotInstance(opcode.type), opcode, { $$typeof: undefined });
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return opcode;
    });
  }

  if (__PROFILE__) {
    console.profile('renderOpcodesInto');
  }

  const refs: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  renderOpcodesInto(opcodes, __root as any, refs);
  refs.forEach((ref) => ref());
  refs.length = 0;

  if (__ENABLE_SSR__) {
    __root.__opcodes = opcodes;
  }
  if (__PROFILE__) {
    console.profileEnd();
  }
}

export { renderMainThread };
