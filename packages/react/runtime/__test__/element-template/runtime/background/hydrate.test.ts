import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hydrate } from '../../../../src/element-template/background/hydrate.js';
import {
  BackgroundElementTemplateInstance,
  BackgroundElementTemplateSlot,
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
} from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import type {
  SerializedElementNode,
  SerializedElementTemplate,
  SerializedTemplateInstance,
} from '../../../../src/element-template/protocol/types.js';

function createHydrationTemplate(
  handleId: number,
  templateKey: string,
  options: {
    attributeSlots?: unknown[];
    elementSlots?: SerializedTemplateInstance[][];
    runtimeOptions?: Record<string, unknown>;
  } = {},
): SerializedElementTemplate {
  return {
    templateKey,
    attributeSlots: (options.attributeSlots ?? []) as SerializedElementTemplate['attributeSlots'],
    elementSlots: (options.elementSlots ?? []) as SerializedElementTemplate['elementSlots'],
    options: {
      handleId,
      ...(options.runtimeOptions ?? {}),
    },
  };
}

function createHydrationChild(
  handleId: number,
  templateKey: string,
  options: {
    attributeSlots?: unknown[];
    elementSlots?: SerializedTemplateInstance[][];
    runtimeOptions?: Record<string, unknown>;
  } = {},
): SerializedTemplateInstance {
  return {
    kind: 'templateInstance',
    ...createHydrationTemplate(handleId, templateKey, options),
  };
}

describe('hydrate', () => {
  beforeEach(() => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
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
      4,
      root.instanceId,
      0,
      -3,
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

  it('copies serialized runtime options onto hydrated roots and placeholders', () => {
    const root = new BackgroundElementTemplateInstance('root');

    hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        runtimeOptions: { cssId: 100, entryName: 'lazy-entry' },
        elementSlots: [[
          createHydrationChild(-2, 'child', {
            runtimeOptions: { cssId: 200, entryName: 'nested-entry' },
          }),
        ]],
      }),
      root,
    );

    const placeholder = backgroundElementTemplateInstanceManager.get(-2);
    expect(root.options).toEqual({
      handleId: root.instanceId,
      cssId: 100,
      entryName: 'lazy-entry',
    });
    expect(placeholder?.options).toEqual({
      handleId: -2,
      cssId: 200,
      entryName: 'nested-entry',
    });
  });

  it('ignores non-template serialized children inside element slots by design', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const invalidChild = {
      kind: 'element',
      tag: 'view',
      attributes: {},
      children: [],
    } as unknown as SerializedTemplateInstance;

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
      `invalid handleId ${root.instanceId} for 'root': bad handle`,
    );

    updateIdSpy.mockRestore();
    lynx.reportError = oldReportError;
    (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
  });

  it('treats missing serialized slot arrays as empty', () => {
    const root = new BackgroundElementTemplateInstance('root');

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [undefined as unknown as SerializedTemplateInstance[]],
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
        options: {
          handleId: root.instanceId,
        },
      } as unknown as SerializedElementTemplate,
      root,
    );

    expect(stream).toEqual([]);
    expect(root.attributeSlots).toEqual([]);
    expect(root.elementSlots).toEqual([]);
  });

  it('skips sparse background slot indexes when checking trailing slots', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 2);
    root.appendChild(slot);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [
          undefined as unknown as SerializedTemplateInstance[],
          undefined as unknown as SerializedTemplateInstance[],
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
            kind: 'templateInstance',
            templateKey: 'child',
            attributeSlots: [],
            elementSlots: [],
          } as SerializedTemplateInstance,
        ]],
      }),
      root,
    );

    expect(stream).toEqual([]);
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'invalid nested handleId undefined for \'child\'',
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
      'missing handleId for \'root\'',
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
            kind: 'templateInstance',
            templateKey: 'a',
            attributeSlots: [],
            elementSlots: [],
          } as SerializedTemplateInstance,
          createHydrationChild(childB.instanceId, 'b'),
        ]],
      }),
      root,
    );

    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'invalid nested handleId undefined for \'a\'',
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
      { handleId: grandchild.instanceId },
      1,
      child.instanceId,
      'child',
      null,
      [],
      [[grandchild.instanceId]],
      { handleId: child.instanceId },
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
              kind: 'templateInstance',
              templateKey: 'child',
              attributeSlots: [],
              elementSlots: [],
            } as SerializedTemplateInstance,
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
              kind: 'templateInstance',
              templateKey: 'a',
              attributeSlots: [],
              elementSlots: [],
            } as SerializedTemplateInstance,
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
