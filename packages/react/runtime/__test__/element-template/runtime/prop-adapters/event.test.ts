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
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';

describe('ElementTemplate event bridge', () => {
  function createEventInstance(handleId: number, handler: () => void): BackgroundElementTemplateInstance {
    __etAttrPlanMap.view = [0, adaptEventAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, handleId);
    instance.setAttribute('attributeSlots', [handler]);
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
    createEventInstance(-1, handler);

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
    createEventInstance(-8, onTap);

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
    createEventInstance(-9, handler);

    publishEvent('-9:0:', { type: 'tap' });

    expect(handler).toHaveBeenCalledWith({ type: 'tap' });
    expect(alog.mock.calls).toHaveLength(0);
  });

  it('dispatches publicComponentEvent through the same handler lookup', () => {
    const handler = vi.fn();
    const eventData = { type: 'tap' };
    createEventInstance(-2, handler);

    publicComponentEvent('component-id', '-2:0:', eventData);

    expect(handler).toHaveBeenCalledWith(eventData);
  });

  it('reports handler errors without throwing through native', () => {
    const error = new Error('event failed');
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;
    try {
      createEventInstance(-3, () => {
        throw error;
      });

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
    createEventInstance(-4, queuedHandler);
    flushPendingEvents();

    publishEvent('-5:0:', droppedEvent);
    createEventInstance(-5, droppedHandler);

    expect(queuedHandler).toHaveBeenCalledWith(queuedEvent);
    expect(droppedHandler).not.toHaveBeenCalled();
  });

  it('clears queued events when the background runtime is destroyed', () => {
    const handler = vi.fn();
    resetEventStateForRuntime();
    publishEvent('-6:0:', { type: 'tap' });

    destroyElementTemplateBackgroundRuntime();
    createEventInstance(-6, handler);
    flushPendingEvents();

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not queue stale native events after the background runtime is destroyed', () => {
    const handler = vi.fn();
    resetEventStateForRuntime();
    destroyElementTemplateBackgroundRuntime();

    publishEvent('-7:0:', { type: 'tap' });
    createEventInstance(-7, handler);
    flushPendingEvents();

    expect(handler).not.toHaveBeenCalled();
  });
});
