// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, rstest, test } from '@rstest/core';

import {
  OPENUI_DATA_TOOL_NAMES,
  createQueryDataTools,
} from '../src/data-tools/index.js';
import type { QueryDataToolRequest } from '../src/data-tools/index.js';

function deferred() {
  let resolve!: (value?: unknown) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test('registers tools, merges inline defaults, and leaves bridge envelopes to the host', async () => {
  const call = rstest.fn(async (
    _request: QueryDataToolRequest,
  ): Promise<unknown> => false);
  const runtime = createQueryDataTools({ call });
  expect(Object.keys(runtime.tools)).toEqual([...OPENUI_DATA_TOOL_NAMES]);
  runtime.setScope('document');
  runtime.publishDefaults('old-document', { ignored: true });
  expect(call).not.toHaveBeenCalled();
  runtime.publishDefaults('document', { count: 0 });
  runtime.publishDefaults('document', { enabled: false });
  runtime.setScope('document');
  runtime.publishDefaults('document', { count: 0 });
  expect(call).toHaveBeenCalledTimes(2);
  expect(call).toHaveBeenLastCalledWith({
    scope: 'document',
    operation: 'initialize',
    args: { defaults: { count: 0, enabled: false } },
  });
  expect(await runtime.tools.openui_query({ key: 'enabled' })).toBe(false);
  expect(call).toHaveBeenLastCalledWith({
    scope: 'document',
    operation: 'query',
    args: { key: 'enabled' },
  });
  expect(await runtime.tools.openui_mutation({ key: 'count', value: 1 }))
    .toBe(false);
  expect(call.mock.calls[call.mock.calls.length - 1]?.[0].operation).toBe(
    'mutation',
  );
  runtime.dispose();
});

test('waits for the latest registration before dispatching a tool', async () => {
  const first = deferred();
  const second = deferred();
  const call = rstest.fn()
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise)
    .mockResolvedValue(0);
  const runtime = createQueryDataTools({ call });
  runtime.setScope('document');
  const result = runtime.tools.openui_query({ key: 'second' });
  expect(call).not.toHaveBeenCalled();
  runtime.publishDefaults('document', { first: 1 });
  runtime.publishDefaults('document', { second: 2 });
  first.resolve();
  await first.promise;
  expect(call).toHaveBeenCalledTimes(2);
  second.resolve();
  expect(await result).toBe(0);
  expect(call).toHaveBeenCalledTimes(3);
  runtime.dispose();
});

test('scope changes and disposal reject pending calls even if initialization never settles', async () => {
  const never = deferred();
  const call = rstest.fn(() => never.promise);
  const runtime = createQueryDataTools({ call });
  runtime.setScope('first');
  const beforeDefaults = runtime.tools.openui_query({});
  runtime.setScope('second');
  await expect(beforeDefaults).rejects.toThrow('scope changed');
  runtime.publishDefaults('second', {});
  const initializing = runtime.tools.openui_query({});
  runtime.dispose();
  await expect(initializing).rejects.toThrow('scope changed');
  expect(call).toHaveBeenCalledTimes(1);
  await expect(runtime.tools.openui_query({})).rejects.toThrow(
    'scope is not set',
  );
  runtime.setScope('third');
  call.mockResolvedValue(7);
  runtime.publishDefaults('third', { value: 7 });
  expect(await runtime.tools.openui_query({ key: 'value' })).toBe(7);
  runtime.dispose();
});

test('discards in-flight replies when a scope is replaced, including a return to the same scope', async () => {
  const entered = deferred();
  const reply = deferred();
  const runtime = createQueryDataTools({
    async call(request) {
      if (request.operation === 'initialize') return;
      entered.resolve();
      return reply.promise;
    },
  });
  runtime.setScope('first');
  runtime.publishDefaults('first', {});
  const result = runtime.tools.openui_query({});
  await entered.promise;
  runtime.setScope('second');
  runtime.setScope('first');
  await expect(result).rejects.toThrow('scope changed');
  reply.resolve('stale');
  runtime.dispose();
});

test('bounds both missing defaults and pending initialization with the configured timeout', async () => {
  rstest.useFakeTimers();
  const call = rstest.fn(() => deferred().promise);
  const runtime = createQueryDataTools({ call, initializationTimeoutMs: 25 });
  try {
    runtime.setScope('document');
    const missing = expect(runtime.tools.openui_query({})).rejects.toThrow(
      'not ready',
    );
    await rstest.advanceTimersByTimeAsync(25);
    await missing;
    expect(call).not.toHaveBeenCalled();
    runtime.publishDefaults('document', {});
    const pending = expect(runtime.tools.openui_query({})).rejects.toThrow(
      'not ready',
    );
    await rstest.advanceTimersByTimeAsync(25);
    await pending;
    expect(call).toHaveBeenCalledTimes(1);
  } finally {
    runtime.dispose();
    rstest.useRealTimers();
  }
});

test('initialization errors and transport failures propagate without unhandled rejections', async () => {
  const call = rstest.fn((): Promise<unknown> => {
    throw new Error('initialize failed');
  });
  const runtime = createQueryDataTools({ call });
  runtime.setScope('document');
  expect(() => runtime.publishDefaults('document', {})).not.toThrow();
  await expect(runtime.tools.openui_query({})).rejects.toThrow(
    'initialize failed',
  );
  const failed = deferred();
  call.mockImplementation(() => failed.promise);
  runtime.setScope('another');
  runtime.publishDefaults('another', {});
  failed.reject(new Error('registration failed'));
  await expect(runtime.tools.openui_query({})).rejects.toThrow(
    'registration failed',
  );
  call.mockImplementation(async () => undefined);
  runtime.setScope('last');
  runtime.publishDefaults('last', {});
  call.mockImplementation(async () => {
    throw new Error('storage failed');
  });
  await expect(runtime.tools.openui_mutation({})).rejects.toThrow(
    'storage failed',
  );
  runtime.dispose();
});

test('rejects invalid initialization timeouts', () => {
  for (const initializationTimeoutMs of [-1, NaN, Infinity]) {
    expect(() =>
      createQueryDataTools({
        call: async () => undefined,
        initializationTimeoutMs,
      })
    )
      .toThrow('finite and nonnegative');
  }
});
