// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderOpcodesIntoElementTemplate } from '../../../../src/element-template/runtime/render/render-opcodes.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import {
  __etAttrPlanMap,
  adaptEventAttrSlot,
  adaptRefAttrSlot,
  adaptSpreadAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import {
  __OpAttr,
  __OpBegin,
  __OpEnd,
  __OpSlot,
  __OpText,
} from '../../../../src/element-template/runtime/render/render-to-opcodes.js';

describe('renderOpcodesIntoElementTemplate', () => {
  const createElementTemplate = vi.fn();
  const addEvent = vi.fn();

  beforeEach(() => {
    createElementTemplate.mockReset();
    addEvent.mockReset();
    vi.stubGlobal('__CreateElementTemplate', createElementTemplate);
    vi.stubGlobal('__AddEvent', addEvent);
    elementTemplateRegistry.clear();
    clearEtAttrPlanMap();
    resetTemplateId();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearEtAttrPlanMap();
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
      '_et_builtin_raw_text',
      null,
      ['hello'],
      [],
      -1,
    );
    expect(elementTemplateRegistry.get(-1)).toBe(rootTextRef);
  });

  it('prepares direct event slots before native create', () => {
    const rootRef = { kind: 'root-ref' };
    const handleTap = vi.fn();
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_event = [
      0,
      adaptEventAttrSlot,
      2,
      adaptEventAttrSlot,
    ];

    const result = renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: '_et_event' },
      __OpAttr,
      'attributeSlots',
      [handleTap, 'title', 1],
      __OpEnd,
    ]);

    expect(result.rootRefs).toEqual([rootRef]);
    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_event',
      null,
      ['-1:0:', 'title', '-1:2:'],
      null,
      -1,
    );
    expect(addEvent).not.toHaveBeenCalled();
  });

  it('prepares empty direct event values as null before native create', () => {
    const rootRef = { kind: 'root-ref' };
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_event = [
      0,
      adaptEventAttrSlot,
      1,
      adaptEventAttrSlot,
      2,
      adaptEventAttrSlot,
      3,
      adaptEventAttrSlot,
    ];

    renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: '_et_event' },
      __OpAttr,
      'attributeSlots',
      [null, undefined, false, true],
      __OpEnd,
    ]);

    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_event',
      null,
      [null, null, null, '-1:3:'],
      null,
      -1,
    );
    expect(addEvent).not.toHaveBeenCalled();
  });

  it('prepares direct ref values before native create', () => {
    const rootRef = { kind: 'root-ref' };
    const ref = vi.fn();
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_ref = [0, adaptRefAttrSlot];

    renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: '_et_ref' },
      __OpAttr,
      'attributeSlots',
      [ref],
      __OpEnd,
    ]);

    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_ref',
      null,
      ['-1-0'],
      null,
      -1,
    );
    expect(ref).not.toHaveBeenCalled();
  });

  it('prepares spread event values before native create', () => {
    const rootRef = { kind: 'root-ref' };
    const handleTap = vi.fn();
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_spread = [0, adaptSpreadAttrSlot];

    renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: '_et_spread' },
      __OpAttr,
      'attributeSlots',
      [{
        id: 'cta',
        className: 'primary',
        __self: 'debug-self',
        __source: { fileName: 'app.tsx' },
        bindtap: handleTap,
        catchtouchstart: false,
      }],
      __OpEnd,
    ]);

    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_spread',
      null,
      [{ id: 'cta', class: 'primary', bindtap: '-1:0:bindtap', catchtouchstart: null }],
      null,
      -1,
    );
    expect(addEvent).not.toHaveBeenCalled();
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
