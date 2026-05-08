import { beforeEach, describe, expect, it, vi } from 'vitest';

import { destroyElementTemplateBackgroundRuntime } from '../../../../src/element-template/background/destroy.js';
import {
  clearEventHandlers,
  flushPendingEvents,
  publicComponentEvent,
  publishEvent,
  resetEventHandlersForRuntime,
  setEventHandler,
} from '../../../../src/element-template/prop-adapters/event.js';

describe('ElementTemplate event bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearEventHandlers();
  });

  it('dispatches publishEvent to the current handler', () => {
    const handler = vi.fn();
    const eventData = { type: 'tap', detail: { x: 1 } };
    setEventHandler(-1, 0, handler);

    publishEvent('-1:0:', eventData);

    expect(handler).toHaveBeenCalledWith(eventData);
  });

  it('dispatches publicComponentEvent through the same handler lookup', () => {
    const handler = vi.fn();
    const eventData = { type: 'tap' };
    setEventHandler(-2, 0, handler);

    publicComponentEvent('component-id', '-2:0:', eventData);

    expect(handler).toHaveBeenCalledWith(eventData);
  });

  it('reports handler errors without throwing through native', () => {
    const error = new Error('event failed');
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;
    try {
      setEventHandler(-3, 0, () => {
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

    resetEventHandlersForRuntime();
    publishEvent('-4:0:', queuedEvent);
    setEventHandler(-4, 0, queuedHandler);
    flushPendingEvents();

    publishEvent('-5:0:', droppedEvent);
    setEventHandler(-5, 0, droppedHandler);

    expect(queuedHandler).toHaveBeenCalledWith(queuedEvent);
    expect(droppedHandler).not.toHaveBeenCalled();
  });

  it('clears queued events when the background runtime is destroyed', () => {
    const handler = vi.fn();
    resetEventHandlersForRuntime();
    publishEvent('-6:0:', { type: 'tap' });

    destroyElementTemplateBackgroundRuntime();
    setEventHandler(-6, 0, handler);
    flushPendingEvents();

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not queue stale native events after the background runtime is destroyed', () => {
    const handler = vi.fn();
    resetEventHandlersForRuntime();
    destroyElementTemplateBackgroundRuntime();

    publishEvent('-7:0:', { type: 'tap' });
    setEventHandler(-7, 0, handler);
    flushPendingEvents();

    expect(handler).not.toHaveBeenCalled();
  });
});
