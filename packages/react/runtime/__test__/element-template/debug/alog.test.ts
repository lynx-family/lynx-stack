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
      ElementTemplateUpdateOps.createTypedElement,
      13,
      'list',
      [[12]],
      { listChildren: [{ __etHandleRef: 12 }] },
      ElementTemplateUpdateOps.setAttribute,
      13,
      0,
      { insertAction: [] },
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
        op: 'createTypedElement',
        handleId: 13,
        type: 'list',
        elementSlots: [[12]],
        options: { listChildren: [{ __etHandleRef: 12 }] },
      },
      {
        op: 'setAttribute',
        targetId: 13,
        attrSlotIndex: 0,
        value: { insertAction: [] },
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
    const text = new BackgroundElementTemplateInstance('_et_builtin_raw_text', ['hello']);

    root.appendChild(card);
    text.__slotIndex = 2;
    card.appendChild(text);

    const output = printElementTemplateTreeToString(root);

    expect(output).toContain('root#1');
    expect(output).toContain('_et_card#2');
    expect(output).toContain('attributeSlots: ["title"]');
    expect(output).toContain('elementSlots[2]: [3]');
    expect(output).not.toContain('elementSlots[1]');
    expect(output).toContain('_et_builtin_raw_text#3');
    expect(output).toContain('attributeSlots: ["hello"]');
  });

  it('skips sparse element slots when printing the background tree', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const child = new BackgroundElementTemplateInstance('view');
    child.__slotIndex = 1;
    root.appendChild(child);

    const output = printElementTemplateTreeToString(root);

    expect(output).toContain(`view#${child.instanceId}`);
    expect(output).toContain(`elementSlots[1]: [${child.instanceId}]`);
    expect(output).not.toMatch(/elementSlots\[0\]/);
  });

  it('prints an empty marker for missing roots', () => {
    expect(printElementTemplateTreeToString(null)).toBe('<empty>');
  });
});
