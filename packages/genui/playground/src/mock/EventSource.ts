// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
interface MockEvent {
  data?: string;
  target?: MockEventSourceBase;
  type?: string;
}
type Listener = (event: MockEvent) => void;

type EventSourceLikeConstructor = new(url: string) => MockEventSourceBase;

type EventSourceGlobal = typeof globalThis & {
  EventSource?: EventSourceLikeConstructor;
};

/**
 * Minimal subset of the standard `EventSource` surface used by the A2UI
 * playground. Intentionally omitted: `onmessage`/`onerror`/`onopen` setter
 * properties and the `message` default event type. Consumers must use
 * `addEventListener` / `removeEventListener`.
 */
class MockEventSourceBase {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState: number = MockEventSourceBase.CONNECTING;

  private listeners = new Map<string, Listener[]>();
  private closed = false;

  constructor(_url: string, private readonly sequence: unknown[]) {
    void this.emitSequence();
  }

  private async emitSequence() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (this.closed) return;

    this.readyState = MockEventSourceBase.OPEN;
    this.emit('open', {});

    for (const item of this.sequence) {
      if (this.closed) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (this.closed) return;
      const payload = JSON.stringify(item);
      this.emit('delta', { data: payload });
    }

    if (this.closed) return;
    this.emit('complete', { data: undefined });
  }

  addEventListener(type: string, listener: Listener) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: Listener) {
    const list = this.listeners.get(type);
    if (!list) return;
    const idx = list.indexOf(listener);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) this.listeners.delete(type);
  }

  close() {
    this.closed = true;
    this.readyState = MockEventSourceBase.CLOSED;
    this.listeners.clear();
  }

  private emit(type: string, event: MockEvent) {
    const list = this.listeners.get(type);
    if (!list) return;

    const enriched: MockEvent = { ...event, type, target: this };

    for (const listener of list) {
      try {
        listener(enriched);
      } catch (error) {
        console.error('MockEventSource listener error', error);
      }
    }
  }
}

export function installMockEventSource(
  messages: unknown[],
  actionMocks?: Record<string, unknown[]>,
) {
  const defaultSequence: unknown[] = Array.isArray(messages) ? messages : [];

  class MockEventSource extends MockEventSourceBase {
    constructor(url: string) {
      let sequence = defaultSequence;

      try {
        const urlObj = new URL(url, 'http://localhost');
        const text = urlObj.searchParams.get('text');

        // If this is an action request (contains USER_ACTION text),
        // we should not replay the default sequence.
        if (text?.includes('USER_ACTION:')) {
          sequence = []; // Default to empty response for actions

          if (actionMocks) {
            for (const key of Object.keys(actionMocks)) {
              if (text.includes(key)) {
                sequence = actionMocks[key];
                break;
              }
            }
          }
        }
      } catch (e) {
        console.warn('[MockEventSource] Failed to parse URL', url, e);
      }

      super(url, sequence);
    }
  }

  Object.defineProperty(globalThis as EventSourceGlobal, 'EventSource', {
    configurable: true,
    value: MockEventSource,
    writable: true,
  });
}
