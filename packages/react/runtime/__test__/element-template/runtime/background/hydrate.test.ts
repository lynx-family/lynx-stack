import { beforeEach, describe, expect, it, vi } from 'vitest';

import { globalCommitContext } from '../../../../src/element-template/background/commit-context.js';
import {
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
} from '../../../../src/element-template/background/commit-hook.js';
import {
  BackgroundElementTemplateInstance,
  BackgroundListElementTemplateInstance,
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
} from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import type {
  SerializedElementTemplate,
  SerializedTypedNode,
} from '../../../../src/element-template/protocol/types.js';
import {
  __etAttrPlanMap,
  adaptEventAttrSlot,
  adaptMTEventAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { hydrateBackground as hydrate } from '../../test-utils/debug/hydrate.js';

function createHydrationTemplate(
  handleId: number,
  templateKey: string,
  options: {
    attributeSlots?: unknown[] | null;
    bundleUrl?: string;
    elementSlots?: SerializedElementTemplate[][] | null;
  } = {},
): SerializedElementTemplate {
  const serialized: SerializedElementTemplate = {
    templateKey,
    uid: handleId,
  };
  if ('attributeSlots' in options) {
    serialized.attributeSlots = options.attributeSlots as SerializedElementTemplate['attributeSlots'];
  }
  if (options.bundleUrl !== undefined) {
    serialized.bundleUrl = options.bundleUrl;
  }
  if ('elementSlots' in options) {
    serialized.elementSlots = options.elementSlots as SerializedElementTemplate['elementSlots'];
  }
  return serialized;
}

function createHydrationChild(
  handleId: number,
  templateKey: string,
  options: {
    attributeSlots?: unknown[] | null;
    bundleUrl?: string;
    elementSlots?: SerializedElementTemplate[][] | null;
  } = {},
): SerializedElementTemplate {
  return createHydrationTemplate(handleId, templateKey, options);
}

describe('hydrate', () => {
  beforeEach(() => {
    globalThis.__MAIN_THREAD__ = false;
    globalThis.__BACKGROUND__ = true;
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
    clearEtAttrPlanMap();
    resetElementTemplateCommitState();
    vi.clearAllMocks();
    (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
  });

  it('returns an empty stream when background slot children already match', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const child = new BackgroundElementTemplateInstance('child');
    root.appendChild(child);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[createHydrationChild(child.instanceId, 'child')]],
      }),
      root,
    );

    expect(stream).toEqual([]);
    expect(root.elementSlots[0]).toEqual([child]);
  });

  it('binds hydration handles outside development without reporting dev invariant errors', () => {
    const originalDev = globalThis.__DEV__;
    globalThis.__DEV__ = false;
    try {
      const root = new BackgroundElementTemplateInstance('root');
      const oldRootId = root.instanceId;

      const stream = hydrate(
        createHydrationTemplate(-10, 'root'),
        root,
      );

      expect(stream).toEqual([]);
      expect(backgroundElementTemplateInstanceManager.get(oldRootId)).toBeUndefined();
      expect(backgroundElementTemplateInstanceManager.get(-10)).toBe(root);
    } finally {
      globalThis.__DEV__ = originalDev;
    }
  });

  it('forces direct MTEvent hydrate slot updates even when wrappers are deep-equal', () => {
    __etAttrPlanMap.root = [0, adaptMTEventAttrSlot];
    const ctx = { _wkltId: 'tap' };
    const root = new BackgroundElementTemplateInstance('root', [ctx]);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        attributeSlots: [{ type: 'worklet', value: { _wkltId: 'tap' } }],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      root.instanceId,
      0,
      { type: 'worklet', value: ctx },
    ]);
  });

  it('keeps deep-equal hydrate wrappers skipped without a direct MTEvent attr plan', () => {
    const wrapper = { type: 'worklet', value: { _wkltId: 'tap' } };
    const root = new BackgroundElementTemplateInstance('root', [wrapper]);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        attributeSlots: [{ type: 'worklet', value: { _wkltId: 'tap' } }],
      }),
      root,
    );

    expect(stream).toEqual([]);
  });

  it('keeps deep-equal hydrate wrappers skipped when the planned adapter is not MTEvent', () => {
    __etAttrPlanMap.root = [0, adaptEventAttrSlot];
    const wrapper = { type: 'worklet', value: { _wkltId: 'tap' } };
    const root = new BackgroundElementTemplateInstance('root');
    root.attributeSlots = [wrapper];

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        attributeSlots: [{ type: 'worklet', value: { _wkltId: 'tap' } }],
      }),
      root,
    );

    expect(stream).toEqual([]);
  });

  it('keeps direct MTEvent hydrate clears on the normal null diff path', () => {
    __etAttrPlanMap.root = [0, adaptMTEventAttrSlot];
    const root = new BackgroundElementTemplateInstance('root', [false]);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        attributeSlots: [{ type: 'worklet', value: { _wkltId: 'tap' } }],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      root.instanceId,
      0,
      null,
    ]);
  });

  it('keeps ordinary post-hydration direct MTEvent deep-equal updates skipped', () => {
    __etAttrPlanMap.root = [0, adaptMTEventAttrSlot];
    const root = new BackgroundElementTemplateInstance('root', [{ _wkltId: 'tap' }]);

    markElementTemplateHydrated();
    globalCommitContext.ops = [];
    root.setAttribute('attributeSlots', [{ _wkltId: 'tap' }]);

    expect(globalCommitContext.ops).toEqual([]);
  });

  it('patches attribute slots while creating and inserting background-only children', () => {
    const root = new BackgroundElementTemplateInstance('root', ['background-root']);

    const existing = new BackgroundElementTemplateInstance('item', ['background-existing']);
    root.appendChild(existing);

    const card = new BackgroundElementTemplateInstance('card', ['background-card']);
    const rawText = new BackgroundElementTemplateInstance(BUILTIN_RAW_TEXT_TEMPLATE_KEY, ['NEW']);
    card.appendChild(rawText);
    root.appendChild(card);

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
    expect(root.elementSlots[0]).toBeUndefined();
  });

  it('includes nested serialized subtree handles from sparse slots when hydrate removes a stale child', () => {
    const root = new BackgroundElementTemplateInstance('root');

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
    expect(root.elementSlots[0]).toBeUndefined();
    expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
    expect(backgroundElementTemplateInstanceManager.get(101)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(102)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(103)).toBeUndefined();
  });

  it('keeps existing background stale instances on the pending cleanup path during hydrate remove', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const stale = new BackgroundElementTemplateInstance('stale');
    const keep = new BackgroundElementTemplateInstance('keep');
    root.appendChild(keep);

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
    expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([stale]);
  });

  it('moves serialized children to match the background slot order', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const a = new BackgroundElementTemplateInstance('a');
    const b = new BackgroundElementTemplateInstance('b');
    const c = new BackgroundElementTemplateInstance('c');
    root.appendChild(b);
    root.appendChild(a);
    root.appendChild(c);

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
    expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
  });

  it('treats a source-before-target cross-slot hydrate candidate as remove and recreate', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const moved = new BackgroundElementTemplateInstance('moved', ['after']);
    const localId = moved.instanceId;
    const mainThreadId = -2;
    moved.__slotIndex = 1;
    root.appendChild(moved);

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
    expect(root.elementSlots[0]).toBeUndefined();
    expect(root.elementSlots[1]).toEqual([moved]);
    expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
    expect(backgroundElementTemplateInstanceManager.get(mainThreadId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(localId)).toBe(moved);
  });

  it('rejects unsupported typed nodes when they match a live background child', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      const root = new BackgroundElementTemplateInstance('root');
      const typed = new BackgroundElementTemplateInstance('scroll-view');
      root.appendChild(typed);

      const stream = hydrate(
        createHydrationTemplate(root.instanceId, 'root', {
          elementSlots: [[{
            tag: 'scroll-view',
            attributes: null,
            elementSlots: [],
            uid: -10,
          } as SerializedTypedNode]],
        }),
        root,
      );

      expect(stream).toEqual([]);
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        'does not support serialized typed node \'scroll-view\'',
      );
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('does not pull cross-slot hydrate recreate candidates back into a non-empty source slot', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const keep = new BackgroundElementTemplateInstance('keep');
    const moved = new BackgroundElementTemplateInstance('moved', ['after']);
    root.appendChild(keep);
    moved.__slotIndex = 1;
    root.appendChild(moved);

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
    expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
    expect(backgroundElementTemplateInstanceManager.get(-2)).toBeUndefined();
  });

  it('treats a target-before-source cross-slot hydrate candidate as recreate then remove', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const moved = new BackgroundElementTemplateInstance('moved', ['after']);
    const localId = moved.instanceId;
    const mainThreadId = -3;
    root.appendChild(moved);

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
    expect(root.elementSlots[1]).toBeUndefined();
    expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
    expect(backgroundElementTemplateInstanceManager.get(mainThreadId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(localId)).toBe(moved);
  });

  it('recreates repeated cross-slot hydrate candidates in their target slot order', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const first = new BackgroundElementTemplateInstance('item');
    const second = new BackgroundElementTemplateInstance('item');
    const firstLocalId = first.instanceId;
    const secondLocalId = second.instanceId;
    first.__slotIndex = 1;
    root.appendChild(first);
    second.__slotIndex = 1;
    root.appendChild(second);

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
    expect(root.elementSlots[0]).toBeUndefined();
    expect(root.elementSlots[1]).toEqual([first, second]);
    expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
    expect(backgroundElementTemplateInstanceManager.get(-2)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(-3)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(firstLocalId)).toBe(first);
    expect(backgroundElementTemplateInstanceManager.get(secondLocalId)).toBe(second);
  });

  it('recreates background children when serialized root has no child slots', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const child = new BackgroundElementTemplateInstance('child', ['background-child']);
    const rawText = new BackgroundElementTemplateInstance(BUILTIN_RAW_TEXT_TEMPLATE_KEY, ['NEW']);
    child.appendChild(rawText);
    root.appendChild(child);

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

    const newA = new BackgroundElementTemplateInstance('new-a');
    root.appendChild(newA);

    const b0 = new BackgroundElementTemplateInstance('b0');
    b0.__slotIndex = 1;
    const b1 = new BackgroundElementTemplateInstance('b1');
    b1.__slotIndex = 1;
    root.appendChild(b1);
    root.appendChild(b0);

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

    const slot0Item = new BackgroundElementTemplateInstance('item', ['B']);
    slot0Item.__slotIndex = 0;
    const slot1Item = new BackgroundElementTemplateInstance('item', ['A']);
    slot1Item.__slotIndex = 1;
    root.appendChild(slot0Item);
    root.appendChild(slot1Item);

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

  it('matches same local template ids by bundleUrl during hydrate', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const entryB = new BackgroundElementTemplateInstance('entry-b:_et_same', ['B']);
    const entryA = new BackgroundElementTemplateInstance('entry-a:_et_same', ['A']);
    root.appendChild(entryB);
    root.appendChild(entryA);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[
          createHydrationChild(-11, '_et_same', {
            attributeSlots: ['A'],
            bundleUrl: 'entry-a',
          }),
          createHydrationChild(-12, '_et_same', {
            attributeSlots: ['B'],
            bundleUrl: 'entry-b',
          }),
        ]],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.insertNode,
      root.instanceId,
      0,
      entryA.instanceId,
      0,
    ]);
    expect(root.elementSlots[0]).toEqual([entryB, entryA]);
    expect(backgroundElementTemplateInstanceManager.get(-11)).toBe(entryA);
    expect(backgroundElementTemplateInstanceManager.get(-12)).toBe(entryB);
    expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
  });

  it('ignores native main-bundle sentinel urls during hydrate', () => {
    const root = new BackgroundElementTemplateInstance('_et_root');
    const child = new BackgroundElementTemplateInstance('_et_child');
    root.appendChild(child);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, '_et_root', {
        bundleUrl: '__Card__',
        elementSlots: [[createHydrationChild(-2, '_et_child', { bundleUrl: '__Card__' })]],
      }),
      root,
    );

    expect(stream).toEqual([]);
    expect((globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS).toEqual([]);
    expect(backgroundElementTemplateInstanceManager.get(root.instanceId)).toBe(root);
    expect(backgroundElementTemplateInstanceManager.get(-2)).toBe(child);
  });

  it('keeps hydrated handles for later background attribute updates', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const child = new BackgroundElementTemplateInstance('child', ['before']);
    root.appendChild(child);

    const childHandleId = -2;
    hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[createHydrationChild(childHandleId, 'child', { attributeSlots: ['before'] })]],
      }),
      root,
    );

    expect(backgroundElementTemplateInstanceManager.get(childHandleId)).toBe(child);

    markElementTemplateHydrated();
    globalCommitContext.ops = [];
    child.setAttribute('attributeSlots', ['after']);

    expect(globalCommitContext.ops).toEqual([
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

  it('fails serialized-only removal when the stale child uid is invalid', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      const root = new BackgroundElementTemplateInstance('root');

      const stream = hydrate(
        createHydrationTemplate(root.instanceId, 'root', {
          elementSlots: [[createHydrationChild(0, 'child')]],
        }),
        root,
      );

      expect(stream).toEqual([]);
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('invalid uid 0');
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('fails serialized-only removal when a nested stale child uid is invalid', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      const root = new BackgroundElementTemplateInstance('root');

      const stream = hydrate(
        createHydrationTemplate(root.instanceId, 'root', {
          elementSlots: [[createHydrationChild(-2, 'child', {
            elementSlots: [[createHydrationChild(0, 'grandchild')]],
          })]],
        }),
        root,
      );

      expect(stream).toEqual([]);
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('invalid uid 0');
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('fails serialized-only typed list removal when listChildren is missing', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      const root = new BackgroundElementTemplateInstance('root');

      const stream = hydrate(
        createHydrationTemplate(root.instanceId, 'root', {
          elementSlots: [[{
            tag: 'list',
            attributes: null,
            elementSlots: [],
            uid: -10,
          } as SerializedTypedNode]],
        }),
        root,
      );

      expect(stream).toEqual([]);
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        'requires options.listChildren',
      );
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('fails serialized-only typed list removal when generic element slots are present', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      const root = new BackgroundElementTemplateInstance('root');

      const stream = hydrate(
        createHydrationTemplate(root.instanceId, 'root', {
          elementSlots: [[{
            tag: 'list',
            attributes: null,
            elementSlots: [[createHydrationChild(-11, '_et_list_item')]],
            uid: -10,
            options: {
              listChildren: [],
            },
          } as SerializedTypedNode]],
        }),
        root,
      );

      expect(stream).toEqual([]);
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        'does not support elementSlots',
      );
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('fails serialized-only typed list removal when a nested logical child uid is invalid', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      const root = new BackgroundElementTemplateInstance('root');

      const stream = hydrate(
        createHydrationTemplate(root.instanceId, 'root', {
          elementSlots: [[{
            tag: 'list',
            attributes: null,
            elementSlots: [],
            uid: -10,
            options: {
              listChildren: [createHydrationChild(0, '_et_list_item')],
            },
          } as SerializedTypedNode]],
        }),
        root,
      );

      expect(stream).toEqual([]);
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('invalid uid 0');
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('does not retain legacy runtime options on background instances', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[
          createHydrationChild(-2, 'child'),
        ]],
      }),
      root,
    );

    expect(Object.hasOwn(root, 'options')).toBe(false);
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

  it('drops the hydrate stream when a matched child fails to hydrate', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      const root = new BackgroundElementTemplateInstance('root', ['after-root']);
      const child = new BackgroundElementTemplateInstance('child');
      root.appendChild(child);
      const oldRootId = root.instanceId;
      const oldChildId = child.instanceId;

      const stream = hydrate(
        createHydrationTemplate(-1, 'root', {
          attributeSlots: ['before-root'],
          elementSlots: [[
            createHydrationChild(-1, 'child'),
          ]],
        }),
        root,
      );

      expect(stream).toEqual([]);
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        'invalid uid -1 for \'child\'',
      );
      expect(backgroundElementTemplateInstanceManager.get(oldRootId)).toBeUndefined();
      expect(backgroundElementTemplateInstanceManager.get(-1)).toBe(root);
      expect(backgroundElementTemplateInstanceManager.get(oldChildId)).toBe(child);
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
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

  it('treats omitted serialized slots as empty arrays', () => {
    const root = new BackgroundElementTemplateInstance('root', ['background-root']);
    const child = new BackgroundElementTemplateInstance('child');
    root.appendChild(child);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root'),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      root.instanceId,
      0,
      'background-root',
      ElementTemplateUpdateOps.createTemplate,
      child.instanceId,
      'child',
      null,
      [],
      [],
      ElementTemplateUpdateOps.insertNode,
      root.instanceId,
      0,
      child.instanceId,
      0,
    ]);
  });

  it('treats null serialized slots as empty arrays', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        attributeSlots: null,
        elementSlots: null,
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
    const child = new BackgroundElementTemplateInstance('child');
    child.__slotIndex = 2;
    root.appendChild(child);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [
          undefined as unknown as SerializedElementTemplate[],
          undefined as unknown as SerializedElementTemplate[],
          [createHydrationChild(child.instanceId, 'child')],
        ],
      }),
      root,
    );

    expect(stream).toEqual([]);
    expect(root.elementSlots[0]).toBeUndefined();
    expect(root.elementSlots[1]).toBeUndefined();
    expect(root.elementSlots[2]).toEqual([child]);
  });

  it('emits create recursively for inserted nested children', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const child = new BackgroundElementTemplateInstance('child');
    const grandchild = new BackgroundElementTemplateInstance('grandchild');
    child.appendChild(grandchild);
    root.appendChild(child);

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

  it('hydrates native typed list roots from options listChildren', () => {
    const list = new BackgroundListElementTemplateInstance();
    const item = new BackgroundElementTemplateInstance('_et_list_item');
    list.setAttribute('attributes', { id: 'feed' });
    list.appendChild(item);
    const oldListId = list.instanceId;
    const oldItemId = item.instanceId;

    const stream = hydrate(
      {
        tag: 'list',
        attributes: {
          id: 'feed',
          'component-at-index': null,
          'component-at-indexes': null,
          'enqueue-component': null,
          'update-list-info': {
            insertAction: [{ position: 0, type: '_et_list_item' }],
            removeAction: [],
            updateAction: [],
          },
        },
        elementSlots: null,
        uid: -10,
        options: {
          listChildren: [createHydrationChild(-11, '_et_list_item')],
        },
      } satisfies SerializedTypedNode,
      list,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.updateTypedListItem,
      -10,
      { __etHandleRef: -11, type: '_et_list_item', platformInfo: {} },
    ]);
    expect(backgroundElementTemplateInstanceManager.get(oldListId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(oldItemId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(-10)).toBe(list);
    expect(backgroundElementTemplateInstanceManager.get(-11)).toBe(item);
  });

  it('hydrates typed lists outside development while dropping transient native list attributes', () => {
    const originalDev = globalThis.__DEV__;
    globalThis.__DEV__ = false;
    try {
      const list = new BackgroundListElementTemplateInstance();
      const oldListId = list.instanceId;

      const stream = hydrate(
        {
          tag: 'list',
          attributes: {
            'component-at-index': null,
            'component-at-indexes': null,
            'enqueue-component': null,
            'update-list-info': {
              insertAction: [],
              removeAction: [],
              updateAction: [],
            },
          },
          elementSlots: null,
          uid: -10,
          options: {
            listChildren: [],
          },
        } satisfies SerializedTypedNode,
        list,
      );

      expect(stream).toEqual([]);
      expect(backgroundElementTemplateInstanceManager.get(oldListId)).toBeUndefined();
      expect(backgroundElementTemplateInstanceManager.get(-10)).toBe(list);
    } finally {
      globalThis.__DEV__ = originalDev;
    }
  });

  it('hydrates nested typed list children inside compiled parent slots', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const list = new BackgroundListElementTemplateInstance();
    const item = new BackgroundElementTemplateInstance('_et_list_item');
    list.setAttribute('attributes', { id: 'feed' });
    list.appendChild(item);
    root.appendChild(list);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[{
          tag: 'list',
          attributes: { id: 'feed' },
          elementSlots: null,
          uid: -10,
          options: {
            listChildren: [createHydrationChild(-11, '_et_list_item')],
          },
        } as SerializedTypedNode]],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.updateTypedListItem,
      -10,
      { __etHandleRef: -11, type: '_et_list_item', platformInfo: {} },
    ]);
    expect(backgroundElementTemplateInstanceManager.get(-10)).toBe(list);
    expect(backgroundElementTemplateInstanceManager.get(-11)).toBe(item);
  });

  it('reconciles typed list hydrate when the background list has extra item roots', () => {
    const list = new BackgroundListElementTemplateInstance();
    const first = new BackgroundElementTemplateInstance('_et_item_a');
    const second = new BackgroundElementTemplateInstance('_et_item_b', ['second']);
    first.setAttribute('__listItemPlatformInfo', { 'item-key': 'a' });
    second.setAttribute('__listItemPlatformInfo', { 'item-key': 'b' });
    list.appendChild(first);
    list.appendChild(second);
    const secondLocalId = second.instanceId;

    const stream = hydrate(
      {
        tag: 'list',
        attributes: null,
        elementSlots: [],
        uid: -10,
        options: {
          listChildren: [createHydrationChild(-11, '_et_item_a')],
        },
      } satisfies SerializedTypedNode,
      list,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.createTemplate,
      secondLocalId,
      '_et_item_b',
      null,
      ['second'],
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      -10,
      { __etHandleRef: secondLocalId, type: '_et_item_b', platformInfo: { 'item-key': 'b' } },
      0,
      ElementTemplateUpdateOps.updateTypedListItem,
      -10,
      { __etHandleRef: -11, type: '_et_item_a', platformInfo: { 'item-key': 'a' } },
    ]);
    expect(backgroundElementTemplateInstanceManager.get(secondLocalId)).toBe(second);
  });

  it('orders typed list hydrate inserts so pending anchors exist before earlier siblings', () => {
    const list = new BackgroundListElementTemplateInstance();
    const extraFirst = new BackgroundElementTemplateInstance('_et_item_x', ['x']);
    const extraSecond = new BackgroundElementTemplateInstance('_et_item_y', ['y']);
    const existing = new BackgroundElementTemplateInstance('_et_item_a');
    extraFirst.setAttribute('__listItemPlatformInfo', { 'item-key': 'x' });
    extraSecond.setAttribute('__listItemPlatformInfo', { 'item-key': 'y' });
    existing.setAttribute('__listItemPlatformInfo', { 'item-key': 'a' });
    list.appendChild(extraFirst);
    list.appendChild(extraSecond);
    list.appendChild(existing);
    const extraFirstLocalId = extraFirst.instanceId;
    const extraSecondLocalId = extraSecond.instanceId;

    const stream = hydrate(
      {
        tag: 'list',
        attributes: null,
        elementSlots: [],
        uid: -10,
        options: {
          listChildren: [createHydrationChild(-11, '_et_item_a')],
        },
      } satisfies SerializedTypedNode,
      list,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.createTemplate,
      extraSecondLocalId,
      '_et_item_y',
      null,
      ['y'],
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      -10,
      { __etHandleRef: extraSecondLocalId, type: '_et_item_y', platformInfo: { 'item-key': 'y' } },
      -11,
      ElementTemplateUpdateOps.createTemplate,
      extraFirstLocalId,
      '_et_item_x',
      null,
      ['x'],
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      -10,
      { __etHandleRef: extraFirstLocalId, type: '_et_item_x', platformInfo: { 'item-key': 'x' } },
      extraSecondLocalId,
      ElementTemplateUpdateOps.updateTypedListItem,
      -10,
      { __etHandleRef: -11, type: '_et_item_a', platformInfo: { 'item-key': 'a' } },
    ]);
  });

  it('reconciles typed list hydrate when serialized list has stale item roots', () => {
    const list = new BackgroundListElementTemplateInstance();
    const first = new BackgroundElementTemplateInstance('_et_item_a');
    first.setAttribute('__listItemPlatformInfo', { 'item-key': 'a' });
    list.appendChild(first);

    const stream = hydrate(
      {
        tag: 'list',
        attributes: null,
        elementSlots: [],
        uid: -10,
        options: {
          listChildren: [
            createHydrationChild(-11, '_et_item_a'),
            createHydrationChild(-12, '_et_item_b'),
          ],
        },
      } satisfies SerializedTypedNode,
      list,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.removeTypedListItem,
      -10,
      -12,
      [-12],
      ElementTemplateUpdateOps.updateTypedListItem,
      -10,
      { __etHandleRef: -11, type: '_et_item_a', platformInfo: { 'item-key': 'a' } },
    ]);
    expect(backgroundElementTemplateInstanceManager.get(-12)).toBeUndefined();
  });

  it('rejects unsupported stale typed nodes while reconciling typed list removals', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      const list = new BackgroundListElementTemplateInstance();

      const stream = hydrate(
        {
          tag: 'list',
          attributes: null,
          elementSlots: [],
          uid: -10,
          options: {
            listChildren: [{
              tag: 'scroll-view',
              attributes: null,
              elementSlots: [],
              uid: -11,
            } as SerializedTypedNode],
          },
        } satisfies SerializedTypedNode,
        list,
      );

      expect(stream).toEqual([]);
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        'does not support serialized typed node \'scroll-view\'',
      );
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('reconciles typed list hydrate reorder through incremental list mutations', () => {
    const list = new BackgroundListElementTemplateInstance();
    const itemA = new BackgroundElementTemplateInstance('_et_item_a');
    const itemB = new BackgroundElementTemplateInstance('_et_item_b');
    itemA.setAttribute('__listItemPlatformInfo', { 'item-key': 'a' });
    itemB.setAttribute('__listItemPlatformInfo', { 'item-key': 'b' });
    list.appendChild(itemB);
    list.appendChild(itemA);

    const stream = hydrate(
      {
        tag: 'list',
        attributes: null,
        elementSlots: [],
        uid: -10,
        options: {
          listChildren: [
            createHydrationChild(-11, '_et_item_a'),
            createHydrationChild(-12, '_et_item_b'),
          ],
        },
      } satisfies SerializedTypedNode,
      list,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.removeTypedListItem,
      -10,
      -11,
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      -10,
      { __etHandleRef: -11, type: '_et_item_a', platformInfo: { 'item-key': 'a' } },
      0,
      ElementTemplateUpdateOps.updateTypedListItem,
      -10,
      { __etHandleRef: -12, type: '_et_item_b', platformInfo: { 'item-key': 'b' } },
    ]);
    expect(backgroundElementTemplateInstanceManager.get(-11)).toBe(itemA);
    expect(backgroundElementTemplateInstanceManager.get(-12)).toBe(itemB);
  });

  it('orders typed list hydrate move and insert ops against final anchors', () => {
    const list = new BackgroundListElementTemplateInstance();
    const itemB = new BackgroundElementTemplateInstance('_et_item_b');
    const extra = new BackgroundElementTemplateInstance('_et_item_x', ['x']);
    const itemA = new BackgroundElementTemplateInstance('_et_item_a');
    itemB.setAttribute('__listItemPlatformInfo', { 'item-key': 'b' });
    extra.setAttribute('__listItemPlatformInfo', { 'item-key': 'x' });
    itemA.setAttribute('__listItemPlatformInfo', { 'item-key': 'a', 'reuse-identifier': 'next' });
    list.appendChild(itemB);
    list.appendChild(extra);
    list.appendChild(itemA);
    const extraLocalId = extra.instanceId;

    const stream = hydrate(
      {
        tag: 'list',
        attributes: null,
        elementSlots: [],
        uid: -10,
        options: {
          listChildren: [
            createHydrationChild(-11, '_et_item_a'),
            createHydrationChild(-12, '_et_item_b'),
            createHydrationChild(-13, '_et_item_c'),
          ],
        },
      } satisfies SerializedTypedNode,
      list,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.removeTypedListItem,
      -10,
      -11,
      [],
      ElementTemplateUpdateOps.removeTypedListItem,
      -10,
      -13,
      [-13],
      ElementTemplateUpdateOps.insertTypedListItem,
      -10,
      { __etHandleRef: -11, type: '_et_item_a', platformInfo: { 'item-key': 'a', 'reuse-identifier': 'next' } },
      0,
      ElementTemplateUpdateOps.createTemplate,
      extraLocalId,
      '_et_item_x',
      null,
      ['x'],
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      -10,
      { __etHandleRef: extraLocalId, type: '_et_item_x', platformInfo: { 'item-key': 'x' } },
      -11,
      ElementTemplateUpdateOps.updateTypedListItem,
      -10,
      { __etHandleRef: -12, type: '_et_item_b', platformInfo: { 'item-key': 'b' } },
    ]);
  });

  it('treats typed list item type mismatch as list replacement instead of hydrate failure', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      const list = new BackgroundListElementTemplateInstance();
      const next = new BackgroundElementTemplateInstance('_et_next_item', ['next']);
      next.setAttribute('__listItemPlatformInfo', { 'item-key': 'next' });
      list.appendChild(next);
      const nextLocalId = next.instanceId;

      const stream = hydrate(
        {
          tag: 'list',
          attributes: null,
          elementSlots: [],
          uid: -10,
          options: {
            listChildren: [createHydrationChild(-11, '_et_old_item')],
          },
        } satisfies SerializedTypedNode,
        list,
      );

      expect(reportError).not.toHaveBeenCalled();
      expect(stream).toEqual([
        ElementTemplateUpdateOps.removeTypedListItem,
        -10,
        -11,
        [-11],
        ElementTemplateUpdateOps.createTemplate,
        nextLocalId,
        '_et_next_item',
        null,
        ['next'],
        [],
        ElementTemplateUpdateOps.insertTypedListItem,
        -10,
        { __etHandleRef: nextLocalId, type: '_et_next_item', platformInfo: { 'item-key': 'next' } },
        0,
      ]);
      expect(backgroundElementTemplateInstanceManager.get(-11)).toBeUndefined();
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('refreshes typed list platform info during hydrate', () => {
    const list = new BackgroundListElementTemplateInstance();
    const item = new BackgroundElementTemplateInstance('_et_item');
    item.setAttribute('__listItemPlatformInfo', { 'item-key': 'after', 'reuse-identifier': 'next' });
    list.appendChild(item);

    const stream = hydrate(
      {
        tag: 'list',
        attributes: null,
        elementSlots: [],
        uid: -10,
        options: {
          listChildren: [createHydrationChild(-11, '_et_item')],
        },
      } satisfies SerializedTypedNode,
      list,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.updateTypedListItem,
      -10,
      {
        __etHandleRef: -11,
        type: '_et_item',
        platformInfo: { 'item-key': 'after', 'reuse-identifier': 'next' },
      },
    ]);
  });

  it('rejects typed list hydrate when a matched logical child cannot bind its handle', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      const list = new BackgroundListElementTemplateInstance();
      const item = new BackgroundElementTemplateInstance('_et_item');
      list.appendChild(item);

      const stream = hydrate(
        {
          tag: 'list',
          attributes: null,
          elementSlots: [],
          uid: -10,
          options: {
            listChildren: [createHydrationChild(0, '_et_item')],
          },
        } satisfies SerializedTypedNode,
        list,
      );

      expect(stream).toEqual([]);
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('invalid uid 0');
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('rejects typed list payloads without options listChildren before rebinding handles', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      const list = new BackgroundListElementTemplateInstance();
      const oldListId = list.instanceId;

      const stream = hydrate(
        {
          tag: 'list',
          attributes: null,
          elementSlots: [],
          uid: -10,
        } satisfies SerializedTypedNode,
        list,
      );

      expect(stream).toEqual([]);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        'requires options.listChildren',
      );
      expect(backgroundElementTemplateInstanceManager.get(oldListId)).toBe(list);
      expect(backgroundElementTemplateInstanceManager.get(-10)).toBeUndefined();
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('rejects typed list payloads with invalid holder uid before hydrating children', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      const list = new BackgroundListElementTemplateInstance();
      const oldListId = list.instanceId;

      const stream = hydrate(
        {
          tag: 'list',
          attributes: null,
          elementSlots: [],
          uid: 0,
          options: {
            listChildren: [],
          },
        } satisfies SerializedTypedNode,
        list,
      );

      expect(stream).toEqual([]);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('invalid uid 0');
      expect(backgroundElementTemplateInstanceManager.get(oldListId)).toBe(list);
      expect(backgroundElementTemplateInstanceManager.get(0)).toBeUndefined();
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('rejects typed list payloads with generic elementSlots before rebinding handles', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      const list = new BackgroundListElementTemplateInstance();
      const oldListId = list.instanceId;

      const stream = hydrate(
        {
          tag: 'list',
          attributes: null,
          elementSlots: [[createHydrationChild(-11, '_et_list_item')]],
          uid: -10,
          options: {
            listChildren: [],
          },
        } satisfies SerializedTypedNode,
        list,
      );

      expect(stream).toEqual([]);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        'does not support elementSlots',
      );
      expect(backgroundElementTemplateInstanceManager.get(oldListId)).toBe(list);
      expect(backgroundElementTemplateInstanceManager.get(-10)).toBeUndefined();
      expect(backgroundElementTemplateInstanceManager.get(-11)).toBeUndefined();
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('collects typed list logical children when removing a stale serialized subtree', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[{
          tag: 'list',
          attributes: null,
          elementSlots: null,
          uid: -10,
          options: {
            listChildren: [createHydrationChild(-11, '_et_list_item')],
          },
        } as SerializedTypedNode]],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.removeNode,
      root.instanceId,
      0,
      -10,
      [-10, -11],
    ]);
  });
});
