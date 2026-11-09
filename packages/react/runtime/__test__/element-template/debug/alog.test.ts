import { describe, expect, it } from 'vitest';

import { formatElementTemplateUpdateCommands } from '../../../src/element-template/debug/alog.js';
import { ElementTemplateUpdateOps } from '../../../src/element-template/protocol/opcodes.js';

describe('ElementTemplate alog helpers', () => {
  it('formats update command streams into readable operations', () => {
    expect(formatElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      11,
      '_et_card',
      'main.js',
      ['title'],
      [[12]],
      ElementTemplateUpdateOps.setAttribute,
      11,
      0,
      'updated',
      ElementTemplateUpdateOps.setMainThreadEvent,
      11,
      1,
      { type: 'worklet' },
      ElementTemplateUpdateOps.setMainThreadRef,
      11,
      2,
      { type: 'main-thread-ref' },
      ElementTemplateUpdateOps.createTypedElement,
      13,
      'list',
      { id: 'typed-list' },
      [[12]],
      { listChildren: [{ __etHandleRef: 12 }] },
      ElementTemplateUpdateOps.setAttribute,
      13,
      0,
      { insertAction: [] },
      ElementTemplateUpdateOps.insertTypedListItem,
      13,
      { __etHandleRef: 12, type: '_et_item', platformInfo: { 'item-key': 'a' } },
      0,
      ElementTemplateUpdateOps.removeTypedListItem,
      13,
      12,
      [12],
      ElementTemplateUpdateOps.updateTypedListItem,
      13,
      { __etHandleRef: 12, type: '_et_item', platformInfo: { 'item-key': 'b' } },
      ElementTemplateUpdateOps.insertNode,
      11,
      1,
      12,
      0,
      [12],
      ElementTemplateUpdateOps.removeNode,
      11,
      1,
      12,
      [12],
    ])).toEqual([
      {
        op: 'createTemplate',
        handleId: 11,
        templateKey: '_et_card',
        bundleUrl: 'main.js',
        attributeSlots: ['title'],
        childSlots: [[12]],
      },
      {
        op: 'setAttribute',
        targetId: 11,
        attrSlotIndex: 0,
        value: 'updated',
      },
      {
        op: 'setMainThreadEvent',
        targetId: 11,
        attrSlotIndex: 1,
        value: { type: 'worklet' },
      },
      {
        op: 'setMainThreadRef',
        targetId: 11,
        attrSlotIndex: 2,
        value: { type: 'main-thread-ref' },
      },
      {
        op: 'createTypedElement',
        handleId: 13,
        type: 'list',
        attributes: { id: 'typed-list' },
        childSlots: [[12]],
        options: { listChildren: [{ __etHandleRef: 12 }] },
      },
      {
        op: 'setAttribute',
        targetId: 13,
        attrSlotIndex: 0,
        value: { insertAction: [] },
      },
      {
        op: 'insertTypedListItem',
        targetId: 13,
        item: { __etHandleRef: 12, type: '_et_item', platformInfo: { 'item-key': 'a' } },
        beforeId: 0,
      },
      {
        op: 'removeTypedListItem',
        targetId: 13,
        itemId: 12,
        removedSubtreeHandleIds: [12],
      },
      {
        op: 'updateTypedListItem',
        targetId: 13,
        item: { __etHandleRef: 12, type: '_et_item', platformInfo: { 'item-key': 'b' } },
      },
      {
        op: 'insertNode',
        targetId: 11,
        childSlotIndex: 1,
        childId: 12,
        referenceId: 0,
        attachedSubtreeHandleIds: [12],
      },
      {
        op: 'removeNode',
        targetId: 11,
        childSlotIndex: 1,
        childId: 12,
        removedSubtreeHandleIds: [12],
      },
    ]);
  });

  it('keeps unknown opcodes readable without throwing', () => {
    expect(formatElementTemplateUpdateCommands([99, 'leftover'])).toEqual([
      {
        op: 'unknown',
        opcode: 99,
        index: 0,
        remaining: ['leftover'],
      },
    ]);
  });

  it('formats missing command streams as an empty list', () => {
    expect(formatElementTemplateUpdateCommands(undefined)).toEqual([]);
  });
});
