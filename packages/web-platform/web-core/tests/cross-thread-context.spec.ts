// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { beforeEach, describe, expect, rstest, test } from '@rstest/core';
import {
  DispatchEventResult,
  LynxCrossThreadContext,
} from '../ts/client/LynxCrossThreadContext.js';
import {
  dispatchCoreContextOnBackgroundEndpoint,
  dispatchJSContextOnMainThreadEndpoint,
} from '../ts/client/endpoints.js';
import type { Rpc, RpcEndpoint } from '@lynx-js/web-worker-rpc';
import type { ContextCrossThreadEvent } from '../ts/types/index.js';

type AnyEndpoint = RpcEndpoint<any[], any>;

/**
 * Stands in for `Rpc`, which otherwise needs a real `MessagePort` pair and a
 * second worker. Only the two members `LynxCrossThreadContext` touches are
 * modelled: `invoke` (outbound) and `registerHandler` (inbound). `deliver`
 * plays the role of the peer thread posting a message.
 */
class FakeRpc {
  readonly invocations: { endpoint: string; args: unknown[] }[] = [];
  readonly handlers = new Map<string, (...args: any[]) => unknown>();

  invoke(endpoint: AnyEndpoint, args: unknown[]): void {
    this.invocations.push({ endpoint: endpoint.name, args });
  }

  registerHandler(
    endpoint: AnyEndpoint,
    handler: (...args: any[]) => unknown,
  ): void {
    this.handlers.set(endpoint.name, handler);
  }

  /**
   * Simulates the peer thread invoking `endpoint` on us. Throws when nothing is
   * registered so that a context which never wires up its handler fails loudly
   * instead of silently swallowing the delivery.
   */
  deliver(endpoint: AnyEndpoint, ...args: unknown[]): void {
    const handler = this.handlers.get(endpoint.name);
    if (!handler) {
      throw new Error(
        `no handler registered for rpc endpoint "${endpoint.name}"`,
      );
    }
    handler(...args);
  }

  asRpc(): Rpc {
    return this as unknown as Rpc;
  }
}

// The real wiring, from `createBackgroundLynx`: the background thread receives
// on `dispatchCoreContextOnBackground` and sends on
// `dispatchJSContextOnMainThread`. Keeping the production endpoints (rather
// than ad-hoc ones) means a swap of the two config fields shows up here.
const receiveEventEndpoint = dispatchCoreContextOnBackgroundEndpoint;
const sendEventEndpoint = dispatchJSContextOnMainThreadEndpoint;

describe('LynxCrossThreadContext (lynx.getJSContext / getCoreContext)', () => {
  let rpc: FakeRpc;
  let context: LynxCrossThreadContext;

  beforeEach(() => {
    rstest.resetAllMocks();
    rpc = new FakeRpc();
    context = new LynxCrossThreadContext({
      rpc: rpc.asRpc(),
      receiveEventEndpoint,
      sendEventEndpoint,
    });
  });

  // Outbound: unlike a normal `EventTarget`, `dispatchEvent` is a *send*. It
  // must hand the event to the peer thread and deliberately not run any local
  // listener, because the two directions are separate RPC endpoints.
  describe('dispatchEvent forwards over rpc', () => {
    test('invokes the send endpoint with the event', () => {
      const event: ContextCrossThreadEvent = {
        type: 'my-event',
        data: { hello: 'world' },
      };

      context.dispatchEvent(event);

      expect(rpc.invocations).toHaveLength(1);
      expect(rpc.invocations[0]!.endpoint).toBe(sendEventEndpoint.name);
      // The event travels as a single-element parameter tuple.
      expect(rpc.invocations[0]!.args).toStrictEqual([event]);
    });

    test('sends on the send endpoint, never the receive endpoint', () => {
      context.dispatchEvent({ type: 'my-event', data: {} });
      expect(rpc.invocations[0]!.endpoint).not.toBe(receiveEventEndpoint.name);
    });

    test('does not invoke local listeners', () => {
      const listener = rstest.fn();
      context.addEventListener('my-event', listener);

      context.dispatchEvent({ type: 'my-event', data: {} });

      // Local delivery would double-handle the event: the peer thread echoes
      // back through `receiveEventEndpoint` when it wants us to see it.
      expect(listener).not.toHaveBeenCalled();
      expect(rpc.invocations).toHaveLength(1);
    });

    test('returns CanceledBeforeDispatch', () => {
      const result = context.dispatchEvent({ type: 'my-event', data: {} });
      expect(result).toBe(DispatchEventResult.CanceledBeforeDispatch);
      expect(result).not.toBe(DispatchEventResult.NotCanceled);
    });

    test('forwards each dispatch in order', () => {
      context.dispatchEvent({ type: 'first', data: 1 });
      context.dispatchEvent({ type: 'second', data: 2 });

      expect(rpc.invocations).toHaveLength(2);
      expect(rpc.invocations.map((i) => (i.args[0] as { type: string }).type))
        .toStrictEqual(['first', 'second']);
    });

    test('forwards without requiring __start()', () => {
      // Sending is independent of the inbound handler registration.
      context.dispatchEvent({ type: 'my-event', data: {} });
      expect(rpc.invocations).toHaveLength(1);
    });
  });

  // Inbound: `__start()` registers the RPC handler that turns a `{ type, data }`
  // payload from the peer thread into a local `MessageEvent`.
  describe('__start registers the receive handler', () => {
    test('no handler is registered before __start()', () => {
      expect(rpc.handlers.has(receiveEventEndpoint.name)).toBe(false);
    });

    test('registers on the receive endpoint, not the send endpoint', () => {
      context.__start();
      expect(rpc.handlers.has(receiveEventEndpoint.name)).toBe(true);
      expect(rpc.handlers.has(sendEventEndpoint.name)).toBe(false);
    });

    test('a delivered payload reaches an addEventListener listener', () => {
      const listener = rstest.fn();
      context.addEventListener('my-event', listener);
      context.__start();

      rpc.deliver(receiveEventEndpoint, {
        type: 'my-event',
        data: { hello: 'world' },
      });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0]![0] as MessageEvent;
      expect(event.type).toBe('my-event');
      expect(event.data).toStrictEqual({ hello: 'world' });
    });

    test('delivery does not echo back out over rpc', () => {
      context.__start();
      rpc.deliver(receiveEventEndpoint, { type: 'my-event', data: {} });
      // Receiving must not re-send, which would loop between the threads.
      expect(rpc.invocations).toHaveLength(0);
    });

    test('only listeners for the delivered type run', () => {
      const wanted = rstest.fn();
      const other = rstest.fn();
      context.addEventListener('my-event', wanted);
      context.addEventListener('other-event', other);
      context.__start();

      rpc.deliver(receiveEventEndpoint, { type: 'my-event', data: {} });

      expect(wanted).toHaveBeenCalledTimes(1);
      expect(other).not.toHaveBeenCalled();
    });

    test('supports several listeners on one type', () => {
      const a = rstest.fn();
      const b = rstest.fn();
      context.addEventListener('my-event', a);
      context.addEventListener('my-event', b);
      context.__start();

      rpc.deliver(receiveEventEndpoint, { type: 'my-event', data: {} });

      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });

    test('removeEventListener stops delivery', () => {
      const listener = rstest.fn();
      context.addEventListener('my-event', listener);
      context.__start();

      rpc.deliver(receiveEventEndpoint, { type: 'my-event', data: {} });
      expect(listener).toHaveBeenCalledTimes(1);

      context.removeEventListener('my-event', listener);
      rpc.deliver(receiveEventEndpoint, { type: 'my-event', data: {} });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('a listener added after __start() still receives', () => {
      context.__start();
      const listener = rstest.fn();
      context.addEventListener('my-event', listener);

      rpc.deliver(receiveEventEndpoint, { type: 'my-event', data: {} });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('successive deliveries each fire', () => {
      const seen: unknown[] = [];
      context.addEventListener('my-event', (e) => {
        seen.push((e as MessageEvent).data);
      });
      context.__start();

      rpc.deliver(receiveEventEndpoint, { type: 'my-event', data: 1 });
      rpc.deliver(receiveEventEndpoint, { type: 'my-event', data: 2 });

      expect(seen).toStrictEqual([1, 2]);
    });

    test('two contexts sharing one rpc stay on their own endpoints', () => {
      // `createBackgroundLynx` builds a core context and a devtool context over
      // the same `Rpc`; a delivery to one must not surface on the other.
      const other = new LynxCrossThreadContext({
        rpc: rpc.asRpc(),
        receiveEventEndpoint: sendEventEndpoint,
        sendEventEndpoint: receiveEventEndpoint,
      });
      const mine = rstest.fn();
      const theirs = rstest.fn();
      context.addEventListener('my-event', mine);
      other.addEventListener('my-event', theirs);
      context.__start();
      other.__start();

      rpc.deliver(receiveEventEndpoint, { type: 'my-event', data: {} });

      expect(mine).toHaveBeenCalledTimes(1);
      expect(theirs).not.toHaveBeenCalled();
    });
  });

  // `data: data ?? {}` — an absent payload becomes an empty object. This is a
  // different contract from `LynxEngineContextImpl`, which intentionally keeps
  // `data: undefined`; the two must not be "unified".
  describe('missing data defaults to an empty object', () => {
    const readData = (payload: { type: string; data?: unknown }) => {
      let seen: unknown = 'unset';
      context.addEventListener('my-event', (e) => {
        seen = (e as MessageEvent).data;
      });
      context.__start();
      rpc.deliver(receiveEventEndpoint, payload);
      return seen;
    };

    test('undefined data arrives as {}', () => {
      const seen = readData({ type: 'my-event', data: undefined });
      expect(seen).toStrictEqual({});
      // Without the `?? {}`, `MessageEvent` coerces `undefined` to `null`.
      expect(seen).not.toBeNull();
      expect(seen).not.toBe(undefined);
    });

    test('an absent data property arrives as {}', () => {
      expect(readData({ type: 'my-event' })).toStrictEqual({});
    });

    test('null data also arrives as {}', () => {
      // `??` treats null like undefined.
      const seen = readData({ type: 'my-event', data: null });
      expect(seen).toStrictEqual({});
      expect(seen).not.toBeNull();
    });

    test('falsy-but-present data is preserved verbatim', () => {
      // `??` must not swallow these the way `||` would.
      expect(readData({ type: 'my-event', data: 0 })).toBe(0);
    });

    test('an empty string is preserved', () => {
      expect(readData({ type: 'my-event', data: '' })).toBe('');
    });

    test('array data is preserved', () => {
      expect(readData({ type: 'my-event', data: [1, 2] })).toStrictEqual([
        1,
        2,
      ]);
    });
  });

  describe('postMessage', () => {
    test('is not implemented and reports on console.error', () => {
      const consoleError = rstest.spyOn(console, 'error').mockImplementation(
        () => {},
      );

      context.postMessage({ a: 1 }, 'second');

      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]![0]).toContain(
        'postMessage not implemented',
      );
      // The arguments are echoed for debuggability.
      expect(consoleError.mock.calls[0]!.slice(1)).toStrictEqual([
        { a: 1 },
        'second',
      ]);
      consoleError.mockRestore();
    });

    test('does not send anything over rpc', () => {
      const consoleError = rstest.spyOn(console, 'error').mockImplementation(
        () => {},
      );
      context.postMessage({ a: 1 });
      expect(rpc.invocations).toHaveLength(0);
      consoleError.mockRestore();
    });
  });

  // Regression guard for the harness itself. `__start()` builds a
  // `MessageEvent` and passes it to `EventTarget.prototype.dispatchEvent`,
  // which brand-checks its argument. If `tests/jsdom.ts` ever supplies `Event`
  // from jsdom without also supplying the matching `EventTarget`, the two
  // realms disagree and every delivery throws
  // `TypeError: The "event" argument must be an instance of Event` — which is
  // exactly why this class went untested for so long.
  describe('Event/EventTarget realm agreement', () => {
    test('delivery does not throw a realm brand-check TypeError', () => {
      context.__start();
      expect(() => {
        rpc.deliver(receiveEventEndpoint, { type: 'my-event', data: {} });
      }).not.toThrow();
    });

    test('the delivered object is a real Event instance', () => {
      const listener = rstest.fn();
      context.addEventListener('my-event', listener);
      context.__start();

      rpc.deliver(receiveEventEndpoint, { type: 'my-event', data: {} });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0]![0]).toBeInstanceOf(Event);
    });
  });
});
