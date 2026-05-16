import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { destroyElementTemplateBackgroundRuntime } from '../../../../src/element-template/background/destroy.js';
import { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import {
  clearEventState,
  flushPendingEvents,
  publicComponentEvent,
  publishEvent,
  resetEventStateForRuntime,
} from '../../../../src/element-template/prop-adapters/event.js';
import {
  __etAttrPlanMap,
  adaptEventAttrSlot,
  adaptSpreadAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';

describe('ElementTemplate event bridge', () => {
  function createEventInstance(
    handleId: number,
    attrPlan: typeof __etAttrPlanMap[string],
    rawSlots: unknown[],
  ): BackgroundElementTemplateInstance {
    __etAttrPlanMap.view = attrPlan;
    const instance = new BackgroundElementTemplateInstance('view');
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, handleId);
    instance.setAttribute('attributeSlots', rawSlots);
    return instance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
    clearEtAttrPlanMap();
    clearEventState();
    globalThis.__ALOG__ = true;
  });

  afterEach(() => {
    globalThis.__ALOG__ = true;
  });

  it('dispatches publishEvent to the current handler', () => {
    const handler = vi.fn();
    const eventData = { type: 'tap', detail: { x: 1 } };
    createEventInstance(-1, [0, adaptEventAttrSlot], [handler]);

    publishEvent('-1:0:', eventData);

    expect(handler).toHaveBeenCalledWith(eventData);
  });

  it('logs dispatch metadata when alog is enabled', () => {
    const alog = console.alog as unknown as { mock: { calls: unknown[][] }; mockClear(): void };
    alog.mockClear();
    const received: unknown[] = [];
    function onTap(data: unknown) {
      received.push(data);
    }
    createEventInstance(-8, [0, adaptEventAttrSlot], [onTap]);

    publishEvent('-8:0:', { type: 'tap', detail: { x: 1 } });

    const output = alog.mock.calls.map(args => String(args[0])).join('\n');
    expect(received).toEqual([{ type: 'tap', detail: { x: 1 } }]);
    expect(output).toContain('[ReactLynxDebug] ElementTemplate BTS received event');
    expect(output).toContain('"eventValue": "-8:0:"');
    expect(output).toContain('"type": "tap"');
    expect(output).toContain('"jsFunctionName": "onTap"');
    expect(output).toContain('"hasHandler": true');
  });

  it('skips dispatch alog when alog is disabled', () => {
    globalThis.__ALOG__ = false;
    const alog = console.alog as unknown as { mock: { calls: unknown[][] }; mockClear(): void };
    alog.mockClear();
    const handler = vi.fn();
    createEventInstance(-9, [0, adaptEventAttrSlot], [handler]);

    publishEvent('-9:0:', { type: 'tap' });

    expect(handler).toHaveBeenCalledWith({ type: 'tap' });
    expect(alog.mock.calls).toHaveLength(0);
  });

  it('dispatches publicComponentEvent through the same handler lookup', () => {
    const handler = vi.fn();
    const eventData = { type: 'tap' };
    createEventInstance(-2, [0, adaptEventAttrSlot], [handler]);

    publicComponentEvent('component-id', '-2:0:', eventData);

    expect(handler).toHaveBeenCalledWith(eventData);
  });

  it('dispatches spread event values through the same handler lookup', () => {
    const handler = vi.fn();
    const eventData = { type: 'tap', spread: true };
    createEventInstance(-8, [0, adaptSpreadAttrSlot], [{ bindtap: handler }]);

    publishEvent('-8:0:bindtap', eventData);

    expect(handler).toHaveBeenCalledWith(eventData);
  });

  it('dispatches direct and spread event values from their owning raw slots', () => {
    const directHandler = vi.fn();
    const spreadHandler = vi.fn();
    createEventInstance(
      -9,
      [0, adaptEventAttrSlot, 1, adaptSpreadAttrSlot],
      [directHandler, { bindtap: spreadHandler }],
    );

    publishEvent('-9:0:', { type: 'tap', direct: true });
    publishEvent('-9:1:bindtap', { type: 'tap', spread: true });

    expect(directHandler).toHaveBeenCalledWith({ type: 'tap', direct: true });
    expect(spreadHandler).toHaveBeenCalledWith({ type: 'tap', spread: true });
  });

  it('reports handler errors without throwing through native', () => {
    const error = new Error('event failed');
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;
    try {
      createEventInstance(-3, [0, adaptEventAttrSlot], [() => {
        throw error;
      }]);

      expect(() => publishEvent('-3:0:', { type: 'tap' })).not.toThrow();
      expect(reportError).toHaveBeenCalledWith(error);
    } finally {
      lynx.reportError = oldReportError;
    }
  });

  it('queues missing handlers before hydrate and drops missing handlers after flush', () => {
    const queuedHandler = vi.fn();
    const droppedHandler = vi.fn();
    const queuedEvent = { type: 'tap', phase: 'before-hydrate' };
    const droppedEvent = { type: 'tap', phase: 'after-hydrate' };

    resetEventStateForRuntime();
    publishEvent('-4:0:', queuedEvent);
    createEventInstance(-4, [0, adaptEventAttrSlot], [queuedHandler]);
    flushPendingEvents();

    publishEvent('-5:0:', droppedEvent);
    createEventInstance(-5, [0, adaptEventAttrSlot], [droppedHandler]);

    expect(queuedHandler).toHaveBeenCalledWith(queuedEvent);
    expect(droppedHandler).not.toHaveBeenCalled();
  });

  it('clears queued events when the background runtime is destroyed', () => {
    const handler = vi.fn();
    resetEventStateForRuntime();
    publishEvent('-6:0:', { type: 'tap' });

    destroyElementTemplateBackgroundRuntime();
    createEventInstance(-6, [0, adaptEventAttrSlot], [handler]);
    flushPendingEvents();

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not queue stale native events after the background runtime is destroyed', () => {
    const handler = vi.fn();
    resetEventStateForRuntime();
    destroyElementTemplateBackgroundRuntime();

    publishEvent('-7:0:', { type: 'tap' });
    createEventInstance(-7, [0, adaptEventAttrSlot], [handler]);
    flushPendingEvents();

    expect(handler).not.toHaveBeenCalled();
  });
});
