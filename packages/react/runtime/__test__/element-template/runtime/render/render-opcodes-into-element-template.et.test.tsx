// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderOpcodesIntoElementTemplate } from '../../../../src/element-template/runtime/render/render-opcodes.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { ElementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import {
  __OpBegin,
  __OpEnd,
  __OpSlot,
  __OpText,
} from '../../../../src/element-template/runtime/render/render-to-opcodes.js';

describe('renderOpcodesIntoElementTemplate', () => {
  const createElementTemplate = vi.fn();

  beforeEach(() => {
    createElementTemplate.mockReset();
    vi.stubGlobal('__CreateElementTemplate', createElementTemplate);
    ElementTemplateRegistry.clear();
    resetTemplateId();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when popping the root frame', () => {
    expect(() => renderOpcodesIntoElementTemplate([__OpEnd])).toThrow(
      'Popped root frame',
    );
  });

  it('creates root text through the builtin raw-text template with a handle id', () => {
    const rootTextRef = { kind: 'text-ref' };
    createElementTemplate.mockReturnValue(rootTextRef);

    const result = renderOpcodesIntoElementTemplate([__OpText, 'hello']);

    expect(result.rootRefs).toEqual([rootTextRef]);
    expect(createElementTemplate).toHaveBeenCalledWith(
      '__et_builtin_raw_text__',
      null,
      ['hello'],
      [],
      -1,
    );
    expect(ElementTemplateRegistry.get(-1)).toBe(rootTextRef);
  });

  it('throws when text is emitted outside of an element slot', () => {
    expect(() =>
      renderOpcodesIntoElementTemplate([
        __OpBegin,
        { type: '_et_parent' },
        __OpText,
        'hello',
        __OpEnd,
      ])
    ).toThrow('Template \'_et_parent\' received a text child outside of any element slot.');
  });

  it('throws when an element child is emitted outside of an element slot', () => {
    expect(() =>
      renderOpcodesIntoElementTemplate([
        __OpBegin,
        { type: '_et_parent' },
        __OpBegin,
        { type: '_et_child' },
        __OpSlot,
        0,
        __OpEnd,
        __OpEnd,
      ])
    ).toThrow('Template \'_et_parent\' received a child outside of any element slot.');
  });

  it('throws on unknown opcodes', () => {
    expect(() => renderOpcodesIntoElementTemplate([999])).toThrow(
      'Unknown opcode: 999',
    );
  });
});
