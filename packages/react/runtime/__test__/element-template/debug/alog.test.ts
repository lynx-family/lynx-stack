import { beforeEach, describe, expect, it } from 'vitest';

import { BackgroundElementTemplateInstance } from '../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../src/element-template/background/manager.js';
import {
  formatElementTemplateUpdateCommands,
  printElementTemplateTreeToString,
} from '../../../src/element-template/debug/alog.js';
import { ElementTemplateUpdateOps } from '../../../src/element-template/protocol/opcodes.js';

describe('ElementTemplate alog helpers', () => {
  beforeEach(() => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
  });

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
      ElementTemplateUpdateOps.insertNode,
      11,
      1,
      12,
      0,
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
        elementSlots: [[12]],
      },
      {
        op: 'setAttribute',
        targetId: 11,
        attrSlotIndex: 0,
        value: 'updated',
      },
      {
        op: 'insertNode',
        targetId: 11,
        elementSlotIndex: 1,
        childId: 12,
        referenceId: 0,
      },
      {
        op: 'removeNode',
        targetId: 11,
        elementSlotIndex: 1,
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

  it('prints a compact background tree summary', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const card = new BackgroundElementTemplateInstance('_et_card', ['title']);
    const text = new BackgroundElementTemplateInstance('__et_builtin_raw_text__', ['hello']);

    root.appendChild(card);
    card.appendChild(text);
    card.elementSlots[0] = [text];
    card.elementSlots[1] = [];

    const output = printElementTemplateTreeToString(root);

    expect(output).toContain('root#1');
    expect(output).toContain('_et_card#2');
    expect(output).toContain('attributeSlots: ["title"]');
    expect(output).toContain('elementSlots[0]: [3]');
    expect(output).not.toContain('elementSlots[1]');
    expect(output).toContain('__et_builtin_raw_text__#3');
    expect(output).toContain('attributeSlots: ["hello"]');
  });

  it('prints an empty marker for missing roots', () => {
    expect(printElementTemplateTreeToString(null)).toBe('<empty>');
  });
});
