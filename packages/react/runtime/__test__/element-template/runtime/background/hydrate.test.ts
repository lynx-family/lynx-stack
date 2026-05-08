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

  it('creates missing slots and stringifies raw-text placeholder values', () => {
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

    const slot = root.firstChild as BackgroundElementTemplateSlot | null;
    const rawTrue = backgroundElementTemplateInstanceManager.get(-2);
    const rawEmpty = backgroundElementTemplateInstanceManager.get(-3);
    expect(slot).toBeInstanceOf(BackgroundElementTemplateSlot);
    expect(slot?.partId).toBe(0);
    expect(rawTrue?.text).toBe('true');
    expect(rawEmpty?.text).toBe('');
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

  it('creates non-raw placeholders with copied attribute slots and bound handles', () => {
    const root = new BackgroundElementTemplateInstance('root');

    hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[createHydrationChild(-2, 'child', { attributeSlots: ['payload'] })]],
      }),
      root,
    );

    const placeholder = backgroundElementTemplateInstanceManager.get(-2);
    expect(placeholder?.type).toBe('child');
    expect(placeholder?.attributeSlots).toEqual(['payload']);
  });

  it('does not hydrate runtime options from the serialized identity field', () => {
    const root = new BackgroundElementTemplateInstance('root');

    hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[
          createHydrationChild(-2, 'child'),
        ]],
      }),
      root,
    );

    const placeholder = backgroundElementTemplateInstanceManager.get(-2);
    expect(root.options).toBeUndefined();
    expect(placeholder?.options).toBeUndefined();
  });

  it('ignores invalid non-template payloads inside element slots defensively', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const invalidChild = {
      kind: 'element',
      tag: 'view',
      attributes: {},
      children: [],
    } as unknown as SerializedElementTemplate;

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[invalidChild]],
      }),
      root,
    );

    expect(stream).toEqual([]);
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

  it('treats null serialized attributeSlots and elementSlots as empty', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const stream = hydrate(
      {
        templateKey: 'root',
        attributeSlots: null,
        elementSlots: null,
        uid: root.instanceId,
      } as unknown as SerializedElementTemplate,
      root,
    );

    expect(stream).toEqual([]);
    expect(root.attributeSlots).toEqual([]);
    expect(root.elementSlots).toEqual([]);
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

  it('fails fast in dev for nested serialized children without handle ids', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;
    const root = new BackgroundElementTemplateInstance('root');

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[
          {
            templateKey: 'child',
            attributeSlots: [],
            elementSlots: [],
          } as SerializedElementTemplate,
        ]],
      }),
      root,
    );

    expect(stream).toEqual([]);
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'invalid nested uid undefined for \'child\'',
    );
    lynx.reportError = oldReportError;
    (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
  });

  it('fails fast in dev for missing top-level handle ids', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;
    const root = new BackgroundElementTemplateInstance('root');

    const stream = hydrate(
      {
        templateKey: 'root',
        attributeSlots: [],
        elementSlots: [],
      } as SerializedElementTemplate,
      root,
    );

    expect(stream).toEqual([]);
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'missing uid for \'root\'',
    );
    lynx.reportError = oldReportError;
    (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
  });

  it('fails fast in dev for nested move candidates without handle ids', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);
    const childB = new BackgroundElementTemplateInstance('b');
    const childA = new BackgroundElementTemplateInstance('a');
    slot.appendChild(childB);
    slot.appendChild(childA);

    hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[
          {
            templateKey: 'a',
            attributeSlots: [],
            elementSlots: [],
          } as SerializedElementTemplate,
          createHydrationChild(childB.instanceId, 'b'),
        ]],
      }),
      root,
    );

    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'invalid nested uid undefined for \'a\'',
    );
    expect(root.elementSlots[0]).toEqual([childB, childA]);
    lynx.reportError = oldReportError;
    (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
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

  it('keeps placeholder children when nested remove handles are missing in prod mode', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);

    const originalDev = globalThis.__DEV__;
    globalThis.__DEV__ = false;
    try {
      const stream = hydrate(
        createHydrationTemplate(root.instanceId, 'root', {
          elementSlots: [[
            {
              templateKey: 'child',
              attributeSlots: [],
              elementSlots: [],
            } as SerializedElementTemplate,
          ]],
        }),
        root,
      );

      expect(stream).toEqual([]);
      expect(root.elementSlots[0]?.map(child => child.type)).toEqual(['child']);
    } finally {
      globalThis.__DEV__ = originalDev;
    }
  });

  it('keeps placeholder ordering when nested move handles are missing in prod mode', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);
    const childB = new BackgroundElementTemplateInstance('b');
    const childA = new BackgroundElementTemplateInstance('a');
    slot.appendChild(childB);
    slot.appendChild(childA);

    const originalDev = globalThis.__DEV__;
    globalThis.__DEV__ = false;
    try {
      const stream = hydrate(
        createHydrationTemplate(root.instanceId, 'root', {
          elementSlots: [[
            {
              templateKey: 'a',
              attributeSlots: [],
              elementSlots: [],
            } as SerializedElementTemplate,
            createHydrationChild(childB.instanceId, 'b'),
          ]],
        }),
        root,
      );

      expect(stream).toEqual([]);
      expect(root.elementSlots[0]?.map(child => child.type)).toEqual(['a', 'b']);
    } finally {
      globalThis.__DEV__ = originalDev;
    }
  });
});
