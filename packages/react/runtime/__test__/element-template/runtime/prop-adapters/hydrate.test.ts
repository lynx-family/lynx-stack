import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetElementTemplateCommitState } from '../../../../src/element-template/background/commit-hook.js';
import { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import { clearEventState, getEventHandlerForEventValue } from '../../../../src/element-template/prop-adapters/event.js';
import { clearRefState, flushPendingRefs } from '../../../../src/element-template/prop-adapters/ref.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import type { SerializedElementTemplate } from '../../../../src/element-template/protocol/types.js';
import {
  __etAttrPlanMap,
  adaptEventAttrSlot,
  adaptSpreadAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { hydrateBackground as hydrate } from '../../test-utils/debug/hydrate.js';

function createHydrationTemplate(
  handleId: number,
  templateKey: string,
  options: {
    attributeSlots?: unknown[] | null;
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
  if ('elementSlots' in options) {
    serialized.elementSlots = options.elementSlots as SerializedElementTemplate['elementSlots'];
  }
  return serialized;
}

describe('Element Template prop adapter hydration', () => {
  beforeEach(() => {
    globalThis.__MAIN_THREAD__ = false;
    globalThis.__BACKGROUND__ = true;
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
    clearEtAttrPlanMap();
    clearEventState();
    clearRefState();
    resetElementTemplateCommitState();
    vi.clearAllMocks();
  });

  it('registers event handlers for background-only insertion subtrees during hydrate', () => {
    __etAttrPlanMap.child = [0, adaptEventAttrSlot];
    const root = new BackgroundElementTemplateInstance('root');
    const child = new BackgroundElementTemplateInstance('child');
    const handler = vi.fn();
    child.setAttribute('attributeSlots', [handler]);
    root.appendChild(child);

    const stream = hydrate(
      createHydrationTemplate(root.instanceId, 'root', {
        elementSlots: [[]],
      }),
      root,
    );

    const eventValue = `${child.instanceId}:0:`;
    expect(stream).toEqual([
      ElementTemplateUpdateOps.createTemplate,
      child.instanceId,
      'child',
      null,
      [eventValue],
      [],
      ElementTemplateUpdateOps.insertNode,
      root.instanceId,
      0,
      child.instanceId,
      0,
    ]);
    expect(getEventHandlerForEventValue(eventValue)).toBe(handler);
  });

  it('prepares background event handlers with the serialized uid before diffing hydrate slots', () => {
    __etAttrPlanMap.root = [0, adaptEventAttrSlot];
    const root = new BackgroundElementTemplateInstance('root');
    const handler = vi.fn();
    root.setAttribute('attributeSlots', [handler]);

    const stream = hydrate(
      createHydrationTemplate(-7, 'root', {
        attributeSlots: ['-7:0:'],
      }),
      root,
    );

    expect(stream).toEqual([]);
    expect(root.attributeSlots).toEqual(['-7:0:']);
    expect(getEventHandlerForEventValue('-7:0:')).toBe(handler);
  });

  it('patches a hydrated event value when main thread serialized null but background has a handler', () => {
    __etAttrPlanMap.root = [0, adaptEventAttrSlot];
    const root = new BackgroundElementTemplateInstance('root');
    const handler = vi.fn();
    root.setAttribute('attributeSlots', [handler]);

    const stream = hydrate(
      createHydrationTemplate(-8, 'root', {
        attributeSlots: [null],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      -8,
      0,
      '-8:0:',
    ]);
    expect(root.attributeSlots).toEqual(['-8:0:']);
    expect(getEventHandlerForEventValue('-8:0:')).toBe(handler);
  });

  it('patches null when main thread serialized an event value but background clears the handler', () => {
    __etAttrPlanMap.root = [0, adaptEventAttrSlot];
    const root = new BackgroundElementTemplateInstance('root');
    root.setAttribute('attributeSlots', [false]);

    const stream = hydrate(
      createHydrationTemplate(-9, 'root', {
        attributeSlots: ['-9:0:'],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      -9,
      0,
      null,
    ]);
    expect(root.attributeSlots).toEqual([null]);
    expect(getEventHandlerForEventValue('-9:0:')).toBeUndefined();
  });

  it('prepares background spread event handlers with the serialized uid before diffing hydrate slots', () => {
    __etAttrPlanMap.root = [0, adaptSpreadAttrSlot];
    const root = new BackgroundElementTemplateInstance('root');
    const handleTap = vi.fn();
    root.setAttribute('attributeSlots', [{
      id: 'cta',
      bindtap: handleTap,
    }]);
    const temporaryEventValue = `${root.instanceId}:0:bindtap`;
    const preparedSpread = { id: 'cta', bindtap: '-10:0:bindtap' };
    expect(getEventHandlerForEventValue(temporaryEventValue)).toBe(handleTap);

    const stream = hydrate(
      createHydrationTemplate(-10, 'root', {
        attributeSlots: [preparedSpread],
      }),
      root,
    );

    expect(stream).toEqual([]);
    expect(root.attributeSlots).toEqual([preparedSpread]);
    expect(getEventHandlerForEventValue(temporaryEventValue)).toBeUndefined();
    expect(getEventHandlerForEventValue('-10:0:bindtap')).toBe(handleTap);
  });

  it('patches a hydrated spread value when main thread serialized null but background has a spread event', () => {
    __etAttrPlanMap.root = [0, adaptSpreadAttrSlot];
    const root = new BackgroundElementTemplateInstance('root');
    const handleTap = vi.fn();
    root.setAttribute('attributeSlots', [{
      id: 'cta',
      bindtap: handleTap,
    }]);
    const temporaryEventValue = `${root.instanceId}:0:bindtap`;
    const preparedSpread = { id: 'cta', bindtap: '-11:0:bindtap' };
    expect(getEventHandlerForEventValue(temporaryEventValue)).toBe(handleTap);

    const stream = hydrate(
      createHydrationTemplate(-11, 'root', {
        attributeSlots: [null],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      -11,
      0,
      preparedSpread,
    ]);
    expect(root.attributeSlots).toEqual([preparedSpread]);
    expect(getEventHandlerForEventValue(temporaryEventValue)).toBeUndefined();
    expect(getEventHandlerForEventValue('-11:0:bindtap')).toBe(handleTap);
  });

  it('patches null when main thread serialized a spread event value but background clears the spread slot', () => {
    __etAttrPlanMap.root = [0, adaptSpreadAttrSlot];
    const root = new BackgroundElementTemplateInstance('root');
    root.setAttribute('attributeSlots', [false]);

    const stream = hydrate(
      createHydrationTemplate(-12, 'root', {
        attributeSlots: [{ bindtap: '-12:0:bindtap' }],
      }),
      root,
    );

    expect(stream).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      -12,
      0,
      null,
    ]);
    expect(root.attributeSlots).toEqual([null]);
    expect(getEventHandlerForEventValue('-12:0:bindtap')).toBeUndefined();
  });

  it('prepares spread ref markers with the serialized uid without queueing hydrate ref callbacks', () => {
    __etAttrPlanMap.root = [0, adaptSpreadAttrSlot];
    const root = new BackgroundElementTemplateInstance('root');
    const ref = vi.fn();
    root.setAttribute('attributeSlots', [{ ref }]);
    flushPendingRefs();
    expect(ref).toHaveBeenCalledTimes(1);
    ref.mockClear();

    const stream = hydrate(
      createHydrationTemplate(-13, 'root', {
        attributeSlots: [{ ref: '-13-0' }],
      }),
      root,
    );
    flushPendingRefs();

    expect(stream).toEqual([]);
    expect(root.attributeSlots).toEqual([{ ref: '-13-0' }]);
    expect(ref).not.toHaveBeenCalled();
  });
});
