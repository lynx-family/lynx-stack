// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, expect, test } from '@rstest/core';

import { BenchJobStore } from '../service/common/bench/store.js';
import type { BenchJobRequest } from '../service/common/bench/types.js';
import route from '../src/app.js';

const globals = globalThis as typeof globalThis & {
  __A2UI_BENCH_JOB_STORE__?: BenchJobStore;
};
afterEach(() => {
  delete globals.__A2UI_BENCH_JOB_STORE__;
});

function setup(timeoutMs = 1000) {
  const store = new BenchJobStore();
  globals.__A2UI_BENCH_JOB_STORE__ = store;
  const request: BenchJobRequest = {
    groups: [],
    scenarios: [],
    provider: {},
    playground: { browserScreenshots: true },
    settings: {
      repeats: 1,
      parallelism: 1,
      maxRepairAttempts: 0,
      repairEnabled: false,
      judgeEnabled: true,
      renderMetricsEnabled: false,
    },
  };
  const job = store.createJob(request, 1);
  const capture = {
    path: 'screenshot/zip/upload' as const,
    source: '<lynx>https://example.com/path</lynx>',
    fields: {
      entry: 'index.lynxml',
      width: '390',
      height: '844',
    },
    timeoutMs,
  };
  const pending = store.requestScreenshot(
    job.id,
    capture,
    new AbortController().signal,
  );
  const captureId = [...job.screenshots.keys()][0]!;
  const path = `/a2ui/bench/jobs/${job.id}/screenshots/${captureId}`;
  return { store, job, capture, captureId, pending, path };
}

test('replays task IDs, serves original capture fields, and accepts a BMP exactly once', async () => {
  const { store, job, capture, captureId, pending, path } = setup();
  const subscription = store.subscribe(job.id, () => undefined)!;
  expect(subscription.events.at(-1)).toMatchObject({
    event: 'screenshot-requested',
    data: { captureId },
  });
  subscription.unsubscribe();
  const taskResponse = await route.request(path);
  expect(await taskResponse.json()).toEqual(capture);
  const bytes = new Uint8Array([66, 77, 1, 2]);
  const upload = () =>
    route.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'image/bmp' },
      body: bytes,
    });
  const accepted = await upload();
  expect(accepted.status).toBe(200);
  const captureResponse = await pending;
  expect(new Uint8Array(await captureResponse.arrayBuffer())).toEqual(bytes);
  const duplicate = await upload();
  expect(duplicate.status).toBe(409);
  const expired = await route.request(path);
  expect(expired.status).toBe(404);
  expect(job.screenshots.size).toBe(0);
});

test('delivers browser capture errors to Judge without making a remote request', async () => {
  const { pending, path } = setup();
  const uploaded = await route.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Browser cannot reach screenshot service: CORS',
    }),
  });
  expect(uploaded.status).toBe(200);
  const response = await pending;
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({
    error: 'Browser cannot reach screenshot service: CORS',
  });
});

test('rejects oversized uploads and cancels pending captures with their job', async () => {
  const { store, job, pending, path } = setup();
  const uploaded = await route.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'image/bmp', 'Content-Length': '12000000' },
    body: 'BM',
  });
  expect(uploaded.status).toBe(413);
  const rejected = expect(pending).rejects.toThrow();
  store.cancelJob(job.id);
  await rejected;
  expect(job.screenshots.size).toBe(0);
  const expired = await route.request(path);
  expect(expired.status).toBe(404);
});

test('expires tasks when the browser never uploads a screenshot', async () => {
  const { pending, job } = setup(5);
  await expect(pending).rejects.toThrow(
    'Timed out waiting for the browser screenshot',
  );
  expect(job.screenshots.size).toBe(0);
});

test('keeps pending screenshot events when regular event history rolls over', async () => {
  const { store, job, captureId, pending } = setup();
  for (let index = 0; index < 510; index++) {
    store.emit(job.id, 'progress', { index });
  }
  const subscription = store.subscribe(job.id, () => undefined)!;
  expect(subscription.events).toContainEqual(expect.objectContaining({
    event: 'screenshot-requested',
    data: { captureId },
  }));
  subscription.unsubscribe();
  const rejected = expect(pending).rejects.toThrow();
  store.cancelJob(job.id);
  await rejected;
});
