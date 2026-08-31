// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  buildProbeReport,
  submitWithOptimisticCancellation,
  waitForConversationRender,
  waitForDurableTerminal,
  waitForExactResponse,
} from '../scripts/probe-playground-agents-real-helpers.mjs';

describe('packaged real Agent probe failure handling', () => {
  test('accepts a stable shared form once the target conversation is ready', async () => {
    const order: string[] = [];
    const previousForm = { isConnected: true };
    const prompt = { disabled: false };
    const stableForm = {
      isConnected: true,
      querySelector: () => prompt,
    };
    const originalDocument = globalThis.document;
    const originalTextArea = globalThis.HTMLTextAreaElement;
    globalThis.HTMLTextAreaElement = Object as typeof HTMLTextAreaElement;
    globalThis.document = {
      querySelector(selector: string) {
        if (selector === '.conversationListItem-active') {
          return { getAttribute: () => 'conversation-id' };
        }
        if (selector === '#prompt-form') return stableForm;
        return null;
      },
    } as unknown as Document;
    const page = {
      waitForFunction(
        predicate: (value: never) => boolean,
        value: never,
      ) {
        order.push(`ready:${predicate(value)}`);
        return Promise.resolve();
      },
    };
    try {
      await waitForConversationRender(
        page,
        previousForm,
        'conversation-id',
      );
      expect(order).toEqual(['ready:true']);
    } finally {
      globalThis.document = originalDocument;
      globalThis.HTMLTextAreaElement = originalTextArea;
    }
  });

  test('waits for the durable terminal event after the turn record is terminal', async () => {
    let reads = 0;
    await waitForDurableTerminal(() => {
      reads += 1;
      return reads === 3;
    }, 1_000);
    expect(reads).toBe(3);
  });

  test('sets the current prompt and arms the observer before submitting', async () => {
    const order: string[] = [];
    const listeners = new Set<(value: unknown) => void>();
    const observers = new Set<() => void>();
    let turnId = '';
    const control = {
      getAttribute(name: string) {
        if (name === 'data-active-turn-id') return turnId;
        if (name === 'data-active-conversation-id') return 'conversation-id';
        return null;
      },
      click() {
        order.push('cancel');
        for (const listener of listeners) {
          listener(fakeResponse(
            '/api/conversations/conversation-id/turns/turn-id/cancellation',
          ));
        }
      },
    };
    const originalDocument = globalThis.document;
    const originalMutationObserver = globalThis.MutationObserver;
    const originalEvent = globalThis.Event;
    globalThis.document = {
      querySelector: () => control,
    } as unknown as Document;
    globalThis.Event = class {} as unknown as typeof Event;
    globalThis.MutationObserver = class {
      readonly callback: MutationCallback;
      constructor(callback: MutationCallback) {
        this.callback = callback;
      }
      observe() {
        order.push('observe');
        observers.add(() => this.callback([], this));
      }
      disconnect() {
        // The controlled observer remains available for the synthetic mutation.
      }
      takeRecords(): MutationRecord[] {
        return [];
      }
    };
    let submitListener: (() => void) | undefined;
    const page = {
      fill(_selector: string, value: string) {
        order.push(`prompt:${value}`);
        order.push('input');
        return Promise.resolve();
      },
      locator(selector: string) {
        if (selector === '#prompt-form button[type="submit"]') {
          return {
            evaluate: async (
              callback: (
                element: {
                  closest(): {
                    requestSubmit(): void;
                    addEventListener(
                      name: string,
                      listener: () => void,
                      options?: { once?: boolean },
                    ): void;
                    removeEventListener(
                      name: string,
                      listener: () => void,
                    ): void;
                  };
                },
              ) => Promise<unknown>,
            ) =>
              await callback({
                closest: () => ({
                  requestSubmit: () => {
                    order.push('submit');
                    turnId = 'turn-id';
                    submitListener?.();
                  },
                  addEventListener: (_name, listener) => {
                    submitListener = listener;
                  },
                  removeEventListener: (_name, listener) => {
                    if (submitListener === listener) submitListener = undefined;
                  },
                }),
              }),
          };
        }
        throw new Error(`Unexpected selector: ${selector}`);
      },
      on(_name: string, listener: (value: unknown) => void) {
        listeners.add(listener);
      },
      off(_name: string, listener: (value: unknown) => void) {
        listeners.delete(listener);
      },
    };
    try {
      const result = await submitWithOptimisticCancellation(
        page,
        'conversation-id',
        'cancel me',
      );
      expect(result.turnId).toBe('turn-id');
      expect(order).toEqual([
        'prompt:cancel me',
        'input',
        'observe',
        'submit',
        'cancel',
      ]);
    } finally {
      globalThis.document = originalDocument;
      globalThis.MutationObserver = originalMutationObserver;
      globalThis.Event = originalEvent;
    }
  });

  test('reads a synchronously exposed optimistic ID after submitting', async () => {
    const listeners = new Set<(value: unknown) => void>();
    let turnId = '';
    const control = {
      getAttribute(name: string) {
        if (name === 'data-active-turn-id') return turnId;
        if (name === 'data-active-conversation-id') return 'conversation-id';
        return null;
      },
      click() {
        for (const listener of listeners) {
          listener(fakeResponse(
            '/api/conversations/conversation-id/turns/turn-id/cancellation',
          ));
        }
      },
    };
    const originalDocument = globalThis.document;
    const originalMutationObserver = globalThis.MutationObserver;
    const originalEvent = globalThis.Event;
    globalThis.document = {
      querySelector: () => control,
    } as unknown as Document;
    globalThis.Event = class {} as unknown as typeof Event;
    globalThis.MutationObserver = class {
      readonly callback: MutationCallback;
      constructor(callback: MutationCallback) {
        this.callback = callback;
      }
      observe() {
        // This fixture intentionally does not deliver a mutation callback.
      }
      disconnect() {
        // The helper still performs a synchronous post-submit binding read.
      }
      takeRecords(): MutationRecord[] {
        return [];
      }
    };
    let submitListener: (() => void) | undefined;
    const page = {
      fill() {
        return Promise.resolve();
      },
      locator(selector: string) {
        if (selector === '#prompt-form button[type="submit"]') {
          return {
            evaluate: async (
              callback: (
                element: {
                  closest(): {
                    querySelector(): {
                      value: string;
                      dispatchEvent(): boolean;
                    };
                    requestSubmit(): void;
                    addEventListener(
                      name: string,
                      listener: () => void,
                      options?: { once?: boolean },
                    ): void;
                    removeEventListener(
                      name: string,
                      listener: () => void,
                    ): void;
                  };
                },
                prompt: string,
              ) => Promise<unknown>,
              prompt: string,
            ) =>
              await callback({
                closest: () => ({
                  requestSubmit: () => {
                    turnId = 'turn-id';
                    submitListener?.();
                  },
                  addEventListener: (_name, listener) => {
                    submitListener = listener;
                  },
                  removeEventListener: (_name, listener) => {
                    if (submitListener === listener) submitListener = undefined;
                  },
                }),
              }, prompt),
          };
        }
        throw new Error(`Unexpected selector: ${selector}`);
      },
      on(_name: string, listener: (value: unknown) => void) {
        listeners.add(listener);
      },
      off(_name: string, listener: (value: unknown) => void) {
        listeners.delete(listener);
      },
    };
    try {
      const result = await submitWithOptimisticCancellation(
        page,
        'conversation-id',
        'cancel me',
      );
      expect(result.turnId).toBe('turn-id');
    } finally {
      globalThis.document = originalDocument;
      globalThis.MutationObserver = originalMutationObserver;
      globalThis.Event = originalEvent;
    }
  });

  test('cancels an exact response listener without a late rejection', async () => {
    const listeners = new Set<(value: unknown) => void>();
    const page = {
      on(_name: string, listener: (value: unknown) => void) {
        listeners.add(listener);
      },
      off(_name: string, listener: (value: unknown) => void) {
        listeners.delete(listener);
      },
    };
    const waiter = waitForExactResponse(
      page,
      (pathname) => pathname === '/cancellation',
    );
    const settled = waiter.promise.catch((error: unknown) => error);
    expect(listeners.size).toBe(1);
    waiter.cancel();
    await expect(settled).resolves.toBeInstanceOf(Error);
    expect(listeners.size).toBe(0);
  });

  test('cleans the pre-armed waiter when optimistic binding fails', async () => {
    const responseListeners = new Set<(value: unknown) => void>();
    const page = {
      fill() {
        return Promise.resolve();
      },
      locator(selector: string) {
        if (selector !== '#prompt-form button[type="submit"]') {
          throw new Error(`Unexpected selector: ${selector}`);
        }
        return {
          evaluate: () =>
            Promise.reject(
              new Error('Optimistic turn ID was not exposed'),
            ),
        };
      },
      on(_name: string, listener: (value: unknown) => void) {
        responseListeners.add(listener);
      },
      off(_name: string, listener: (value: unknown) => void) {
        responseListeners.delete(listener);
      },
    };

    await expect(
      submitWithOptimisticCancellation(page, 'conversation-id', 'cancel me'),
    ).rejects.toThrow('Optimistic turn ID was not exposed');
    expect(responseListeners.size).toBe(0);
  });

  test('builds an ordered four-row fail-closed report after a fatal probe error', () => {
    const report = buildProbeReport({
      descriptors: [],
      results: [],
      uiConformance: {
        transport:
          'packaged-fake-protocol-daemon-http-sse-control-ui-playwright',
        cancellation: true,
        allowOnce: true,
        deny: true,
        uniqueTerminal: true,
        noLateArtifact: true,
        noOrphanProcesses: true,
        admissionRetry: true,
        awaitingApprovalCancellation: true,
        approvalActor: 'playwright-user-click',
      },
      fatalError: 'browser closed before cancellation response',
    });

    expect(report).toMatchObject({
      ok: false,
      verdict: 'FAIL',
      error: 'browser closed before cancellation response',
    });
    expect(report.results.map((result) => result.id)).toEqual([
      'codex',
      'claude',
      'cursor',
      'trae',
    ]);
    expect(
      report.results.every((result) =>
        result.status === 'NOT RUN' && result.ok === false
        && result.lateArtifactCount === null
      ),
    ).toBe(true);
  });
});

function fakeResponse(pathname: string): unknown {
  return {
    request: () => ({ method: () => 'PUT' }),
    url: () => `http://127.0.0.1${pathname}`,
  };
}
