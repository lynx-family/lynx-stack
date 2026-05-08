import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GlobalCommitContext } from '../../../../src/element-template/background/commit-context.js';
import {
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
} from '../../../../src/element-template/background/commit-hook.js';
import { hydrate } from '../../../../src/element-template/background/hydrate.js';
import {
  BackgroundElementTemplateInstance,
  BackgroundElementTemplateSlot,
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
} from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import type { SerializedElementTemplate } from '../../../../src/element-template/protocol/types.js';

function createHydrationTemplate(
  handleId: number,
  templateKey: string,
  options: {
    attributeSlots?: unknown[];
    elementSlots?: SerializedElementTemplate[][];
  } = {},
): SerializedElementTemplate {
  return {
    templateKey,
    attributeSlots: (options.attributeSlots ?? []) as SerializedElementTemplate['attributeSlots'],
    elementSlots: (options.elementSlots ?? []) as SerializedElementTemplate['elementSlots'],
    uid: handleId,
  };
}

function createHydrationChild(
  handleId: number,
  templateKey: string,
  options: {
    attributeSlots?: unknown[];
    elementSlots?: SerializedElementTemplate[][];
  } = {},
): SerializedElementTemplate {
  return createHydrationTemplate(handleId, templateKey, options);
}

describe('hydrate', () => {
  beforeEach(() => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
    resetElementTemplateCommitState();
    vi.clearAllMocks();
    (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
  });

  it('returns an empty stream when background slot children already match', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);
    const child = new BackgroundElementTemplateInstance('child');
    slot.appendChild(child);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[createHydrationChild(child.instanceId, 'child')]],
      }),
      root,
    );

    expect(stream).toEqual([]);
    expect(root.elementSlots[0]).toEqual([child]);
  });

  it('patches attribute slots while creating and inserting background-only children', () => {
    const root = new BackgroundElementTemplateInstance('root', ['background-root']);
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);

    const existing = new BackgroundElementTemplateInstance('item', ['background-existing']);
    slot.appendChild(existing);

    const card = new BackgroundElementTemplateInstance('card', ['background-card']);
    const cardSlot = new BackgroundElementTemplateSlot();
    cardSlot.setAttribute('id', 0);
    card.appendChild(cardSlot);
    const rawText = new BackgroundElementTemplateInstance(BUILTIN_RAW_TEXT_TEMPLATE_KEY, ['NEW']);
    cardSlot.appendChild(rawText);
    slot.appendChild(card);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        attributeSlots: ['main-root'],
        elementSlots: [[
          createHydrationChild(existing.instanceId, 'item', {
            attributeSlots: ['main-existing'],
          }),
        ]],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      root.instanceId,
      0,
      'background-root',
      ElementTemplateUpdateOps.setAttribute,
      existing.instanceId,
      0,
      'background-existing',
      ElementTemplateUpdateOps.createTemplate,
      rawText.instanceId,
      BUILTIN_RAW_TEXT_TEMPLATE_KEY,
      null,
      ['NEW'],
      [],
      ElementTemplateUpdateOps.createTemplate,
      card.instanceId,
      'card',
      null,
      ['background-card'],
      [[rawText.instanceId]],
      ElementTemplateUpdateOps.insertNode,
      root.instanceId,
      0,
      card.instanceId,
      0,
    ]);
    expect(root.elementSlots[0]).toEqual([existing, card]);
    expect(card.elementSlots[0]).toEqual([rawText]);
  });

  it('removes serialized children that are missing from the background slot', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);

    const stale = new BackgroundElementTemplateInstance('stale');

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[createHydrationChild(stale.instanceId, 'stale')]],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.removeNode,
      root.instanceId,
      0,
      stale.instanceId,
      [stale.instanceId],
    ]);
    expect(root.elementSlots[0]).toEqual([]);
  });

  it('includes nested serialized subtree handles from sparse slots when hydrate removes a stale child', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);

    const stale = createHydrationChild(101, 'stale', {
      elementSlots: [
        undefined as unknown as SerializedElementTemplate[],
        [createHydrationChild(102, 'nested', {
          elementSlots: [[
            createHydrationChild(103, BUILTIN_RAW_TEXT_TEMPLATE_KEY, {
              attributeSlots: ['stale text'],
            }),
          ]],
        })],
      ],
    });

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[stale]],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.removeNode,
      root.instanceId,
      0,
      101,
      [101, 102, 103],
    ]);
    expect(root.elementSlots[0]).toEqual([]);
    expect(GlobalCommitContext.nonPayload.removedSubtrees).toEqual([]);
    expect(backgroundElementTemplateInstanceManager.get(101)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(102)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(103)).toBeUndefined();
  });

  it('keeps existing background stale instances on the pending cleanup path during hydrate remove', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);

    const stale = new BackgroundElementTemplateInstance('stale');
    const keep = new BackgroundElementTemplateInstance('keep');
    slot.appendChild(keep);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[
          createHydrationChild(stale.instanceId, 'stale'),
          createHydrationChild(keep.instanceId, 'keep'),
        ]],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.removeNode,
      root.instanceId,
      0,
      stale.instanceId,
      [stale.instanceId],
    ]);
    expect(root.elementSlots[0]).toEqual([keep]);
    expect(GlobalCommitContext.nonPayload.removedSubtrees).toEqual([stale]);
  });

  it('moves serialized children to match the background slot order', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);

    const a = new BackgroundElementTemplateInstance('a');
    const b = new BackgroundElementTemplateInstance('b');
    const c = new BackgroundElementTemplateInstance('c');
    slot.appendChild(b);
    slot.appendChild(a);
    slot.appendChild(c);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[
          createHydrationChild(a.instanceId, 'a'),
          createHydrationChild(b.instanceId, 'b'),
          createHydrationChild(c.instanceId, 'c'),
        ]],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.insertNode,
      root.instanceId,
      0,
      a.instanceId,
      c.instanceId,
    ]);
    expect(root.elementSlots[0]).toEqual([b, a, c]);
    expect(GlobalCommitContext.nonPayload.removedSubtrees).toEqual([]);
  });

  it('treats a source-before-target cross-slot hydrate candidate as remove and recreate', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot0 = new BackgroundElementTemplateSlot();
    slot0.setAttribute('id', 0);
    root.appendChild(slot0);
    const slot1 = new BackgroundElementTemplateSlot();
    slot1.setAttribute('id', 1);
    root.appendChild(slot1);

    const moved = new BackgroundElementTemplateInstance('moved', ['after']);
    const localId = moved.instanceId;
    const mainThreadId = -2;
    slot1.appendChild(moved);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [
          [createHydrationChild(mainThreadId, 'moved', { attributeSlots: ['before'] })],
          [],
        ],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.removeNode,
      root.instanceId,
      0,
      mainThreadId,
      [mainThreadId],
      ElementTemplateUpdateOps.createTemplate,
      localId,
      'moved',
      null,
      ['after'],
      [],
      ElementTemplateUpdateOps.insertNode,
      root.instanceId,
      1,
      localId,
      0,
    ]);
    expect(root.elementSlots[0]).toEqual([]);
    expect(root.elementSlots[1]).toEqual([moved]);
    expect(GlobalCommitContext.nonPayload.removedSubtrees).toEqual([]);
    expect(backgroundElementTemplateInstanceManager.get(mainThreadId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(localId)).toBe(moved);
  });

  it('does not pull cross-slot hydrate recreate candidates back into a non-empty source slot', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot0 = new BackgroundElementTemplateSlot();
    slot0.setAttribute('id', 0);
    root.appendChild(slot0);
    const slot1 = new BackgroundElementTemplateSlot();
    slot1.setAttribute('id', 1);
    root.appendChild(slot1);

    const keep = new BackgroundElementTemplateInstance('keep');
    const moved = new BackgroundElementTemplateInstance('moved', ['after']);
    slot0.appendChild(keep);
    slot1.appendChild(moved);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [
          [
            createHydrationChild(-2, 'moved', { attributeSlots: ['before'] }),
            createHydrationChild(keep.instanceId, 'keep'),
          ],
          [],
        ],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.removeNode,
      root.instanceId,
      0,
      -2,
      [-2],
      ElementTemplateUpdateOps.createTemplate,
      moved.instanceId,
      'moved',
      null,
      ['after'],
      [],
      ElementTemplateUpdateOps.insertNode,
      root.instanceId,
      1,
      moved.instanceId,
      0,
    ]);
    expect(root.elementSlots[0]).toEqual([keep]);
    expect(root.elementSlots[1]).toEqual([moved]);
    expect(GlobalCommitContext.nonPayload.removedSubtrees).toEqual([]);
    expect(backgroundElementTemplateInstanceManager.get(-2)).toBeUndefined();
  });

  it('treats a target-before-source cross-slot hydrate candidate as recreate then remove', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot0 = new BackgroundElementTemplateSlot();
    slot0.setAttribute('id', 0);
    root.appendChild(slot0);
    const slot1 = new BackgroundElementTemplateSlot();
    slot1.setAttribute('id', 1);
    root.appendChild(slot1);

    const moved = new BackgroundElementTemplateInstance('moved', ['after']);
    const localId = moved.instanceId;
    const mainThreadId = -3;
    slot0.appendChild(moved);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [
          [],
          [createHydrationChild(mainThreadId, 'moved', { attributeSlots: ['before'] })],
        ],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.createTemplate,
      localId,
      'moved',
      null,
      ['after'],
      [],
      ElementTemplateUpdateOps.insertNode,
      root.instanceId,
      0,
      localId,
      0,
      ElementTemplateUpdateOps.removeNode,
      root.instanceId,
      1,
      mainThreadId,
      [mainThreadId],
    ]);
    expect(root.elementSlots[0]).toEqual([moved]);
    expect(root.elementSlots[1]).toEqual([]);
    expect(GlobalCommitContext.nonPayload.removedSubtrees).toEqual([]);
    expect(backgroundElementTemplateInstanceManager.get(mainThreadId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(localId)).toBe(moved);
  });

  it('recreates repeated cross-slot hydrate candidates in their target slot order', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot0 = new BackgroundElementTemplateSlot();
    slot0.setAttribute('id', 0);
    root.appendChild(slot0);
    const slot1 = new BackgroundElementTemplateSlot();
    slot1.setAttribute('id', 1);
    root.appendChild(slot1);

    const first = new BackgroundElementTemplateInstance('item');
    const second = new BackgroundElementTemplateInstance('item');
    const firstLocalId = first.instanceId;
    const secondLocalId = second.instanceId;
    slot1.appendChild(first);
    slot1.appendChild(second);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[
          createHydrationChild(-2, 'item'),
          createHydrationChild(-3, 'item'),
        ], []],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.removeNode,
      root.instanceId,
      0,
      -2,
      [-2],
      ElementTemplateUpdateOps.removeNode,
      root.instanceId,
      0,
      -3,
      [-3],
      ElementTemplateUpdateOps.createTemplate,
      firstLocalId,
      'item',
      null,
      [],
      [],
      ElementTemplateUpdateOps.insertNode,
      root.instanceId,
      1,
      firstLocalId,
      0,
      ElementTemplateUpdateOps.createTemplate,
      secondLocalId,
      'item',
      null,
      [],
      [],
      ElementTemplateUpdateOps.insertNode,
      root.instanceId,
      1,
      secondLocalId,
      0,
    ]);
    expect(root.elementSlots[0]).toEqual([]);
    expect(root.elementSlots[1]).toEqual([first, second]);
    expect(backgroundElementTemplateInstanceManager.get(-2)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(-3)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(firstLocalId)).toBe(first);
    expect(backgroundElementTemplateInstanceManager.get(secondLocalId)).toBe(second);
  });

  it('recreates background children when serialized root has no child slots', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);

    const child = new BackgroundElementTemplateInstance('child', ['background-child']);
    const childSlot = new BackgroundElementTemplateSlot();
    childSlot.setAttribute('id', 0);
    child.appendChild(childSlot);
    const rawText = new BackgroundElementTemplateInstance(BUILTIN_RAW_TEXT_TEMPLATE_KEY, ['NEW']);
    childSlot.appendChild(rawText);
    slot.appendChild(child);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root'),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.createTemplate,
      rawText.instanceId,
      BUILTIN_RAW_TEXT_TEMPLATE_KEY,
      null,
      ['NEW'],
      [],
      ElementTemplateUpdateOps.createTemplate,
      child.instanceId,
      'child',
      null,
      ['background-child'],
      [[rawText.instanceId]],
      ElementTemplateUpdateOps.insertNode,
      root.instanceId,
      0,
      child.instanceId,
      0,
    ]);
    expect(root.elementSlots[0]).toEqual([child]);
    expect(child.elementSlots[0]).toEqual([rawText]);
  });

  it('diffs multiple dynamic children slots independently during hydrate', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot0 = new BackgroundElementTemplateSlot();
    slot0.setAttribute('id', 0);
    root.appendChild(slot0);
    const slot1 = new BackgroundElementTemplateSlot();
    slot1.setAttribute('id', 1);
    root.appendChild(slot1);

    const newA = new BackgroundElementTemplateInstance('new-a');
    slot0.appendChild(newA);

    const b0 = new BackgroundElementTemplateInstance('b0');
    const b1 = new BackgroundElementTemplateInstance('b1');
    slot1.appendChild(b1);
    slot1.appendChild(b0);

    const oldAId = -11;
    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [
          [createHydrationChild(oldAId, 'old-a')],
          [
            createHydrationChild(b0.instanceId, 'b0'),
            createHydrationChild(b1.instanceId, 'b1'),
          ],
        ],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.removeNode,
      root.instanceId,
      0,
      oldAId,
      [oldAId],
      ElementTemplateUpdateOps.createTemplate,
      newA.instanceId,
      'new-a',
      null,
      [],
      [],
      ElementTemplateUpdateOps.insertNode,
      root.instanceId,
      0,
      newA.instanceId,
      0,
      ElementTemplateUpdateOps.insertNode,
      root.instanceId,
      1,
      b0.instanceId,
      0,
    ]);
    expect(root.elementSlots[0]).toEqual([newA]);
    expect(root.elementSlots[1]).toEqual([b1, b0]);
  });

  it('does not match same-type children across element slot indexes', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot0 = new BackgroundElementTemplateSlot();
    slot0.setAttribute('id', 0);
    root.appendChild(slot0);
    const slot1 = new BackgroundElementTemplateSlot();
    slot1.setAttribute('id', 1);
    root.appendChild(slot1);

    const slot0Item = new BackgroundElementTemplateInstance('item', ['B']);
    const slot1Item = new BackgroundElementTemplateInstance('item', ['A']);
    slot0.appendChild(slot0Item);
    slot1.appendChild(slot1Item);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [
          [createHydrationChild(slot0Item.instanceId, 'item', { attributeSlots: ['A'] })],
          [createHydrationChild(slot1Item.instanceId, 'item', { attributeSlots: ['B'] })],
        ],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      slot0Item.instanceId,
      0,
      'B',
      ElementTemplateUpdateOps.setAttribute,
      slot1Item.instanceId,
      0,
      'A',
    ]);
    expect(root.elementSlots[0]).toEqual([slot0Item]);
    expect(root.elementSlots[1]).toEqual([slot1Item]);
  });

  it('keeps hydrated handles for later background attribute updates', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);
    const child = new BackgroundElementTemplateInstance('child', ['before']);
    slot.appendChild(child);

    const childHandleId = -2;
    hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[createHydrationChild(childHandleId, 'child', { attributeSlots: ['before'] })]],
      }),
      root,
    );

    expect(backgroundElementTemplateInstanceManager.get(childHandleId)).toBe(child);

    markElementTemplateHydrated();
    GlobalCommitContext.ops = [];
    child.setAttribute('attributeSlots', ['after']);

    expect(GlobalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      childHandleId,
      0,
      'after',
    ]);
  });

  it('removes serialized-only raw-text children without creating background instances', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[
          createHydrationChild(-2, BUILTIN_RAW_TEXT_TEMPLATE_KEY, { attributeSlots: [true] }),
          createHydrationChild(-3, BUILTIN_RAW_TEXT_TEMPLATE_KEY, { attributeSlots: [{ bad: 'value' }] }),
        ]],
      }),
      root,
    );

    expect(root.firstChild).toBeNull();
    expect(root.elementSlots[0]).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(-2)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(-3)).toBeUndefined();
    expect(stream).toEqual([
      4,
      root.instanceId,
      0,
      -2,
      [-2],
      4,
      root.instanceId,
      0,
      -3,
      [-3],
    ]);
  });

  it('removes serialized-only children without copying them into the background manager', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[createHydrationChild(-2, 'child', { attributeSlots: ['payload'] })]],
      }),
      root,
    );

    expect(backgroundElementTemplateInstanceManager.get(-2)).toBeUndefined();
    expect(stream).toEqual([
      ElementTemplateUpdateOps.removeNode,
      root.instanceId,
      0,
      -2,
      [-2],
    ]);
  });

  it('does not hydrate runtime options from the serialized identity field', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[
          createHydrationChild(-2, 'child'),
        ]],
      }),
      root,
    );

    expect(root.options).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(-2)).toBeUndefined();
    expect(stream).toEqual([
      ElementTemplateUpdateOps.removeNode,
      root.instanceId,
      0,
      -2,
      [-2],
    ]);
  });

  it('reports non-Error failures when rebinding handle ids', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;
    const root = new BackgroundElementTemplateInstance('root');
    const updateIdSpy = vi
      .spyOn(backgroundElementTemplateInstanceManager, 'updateId')
      .mockImplementationOnce(() => {
        throw 'bad handle';
      });

    const stream = hydrate(createHydrationTemplate(root.instanceId, 'root'), root);

    expect(stream).toEqual([]);
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      `invalid uid ${root.instanceId} for 'root': bad handle`,
    );

    updateIdSpy.mockRestore();
    lynx.reportError = oldReportError;
    (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
  });

  it('treats missing serialized slot arrays as empty', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [undefined as unknown as SerializedElementTemplate[]],
      }),
      root,
    );

    expect(stream).toEqual([]);
  });

  it('does not patch serialized null when the background attribute slot is missing', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        attributeSlots: [null],
      }),
      root,
    );

    expect(stream).toEqual([]);
    expect(root.attributeSlots).toEqual([]);
  });

  it('skips sparse background slot indexes when checking trailing slots', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 2);
    root.appendChild(slot);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [
          undefined as unknown as SerializedElementTemplate[],
          undefined as unknown as SerializedElementTemplate[],
          [],
        ],
      }),
      root,
    );

    expect(stream).toEqual([]);
    expect(root.elementSlots[0]).toBeUndefined();
    expect(root.elementSlots[1]).toBeUndefined();
    expect(root.elementSlots[2]).toEqual([]);
  });

  it('emits create recursively for inserted nested children', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);

    const child = new BackgroundElementTemplateInstance('child');
    const childSlot = new BackgroundElementTemplateSlot();
    childSlot.setAttribute('id', 0);
    child.appendChild(childSlot);
    const grandchild = new BackgroundElementTemplateInstance('grandchild');
    childSlot.appendChild(grandchild);
    slot.appendChild(child);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[]],
      }),
      root,
    );

    expect(stream).toEqual([
      1,
      grandchild.instanceId,
      'grandchild',
      null,
      [],
      [],
      1,
      child.instanceId,
      'child',
      null,
      [],
      [[grandchild.instanceId]],
      3,
      root.instanceId,
      0,
      child.instanceId,
      0,
    ]);
  });
});
