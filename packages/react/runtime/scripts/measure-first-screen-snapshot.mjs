// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { performance } from 'node:perf_hooks';

import { parseSnapshotSerialization, stringifyCompactSnapshot } from '../lib/snapshot/snapshot/compactSnapshot.js';

Object.assign(globalThis, {
  __ALOG__: false,
  __BACKGROUND__: true,
  __DEV__: false,
  __EXPERIMENTAL_TRANSFORM_BUILTIN_ATTRIBUTE_NAMES__: false,
  __JS__: true,
  __LEPUS__: false,
  __MAIN_THREAD__: false,
  __PROFILE__: false,
  lynx: {
    queueMicrotask,
  },
});

const {
  BackgroundSnapshotInstance,
  backgroundSnapshotInstanceManager,
  hydrate,
  hydrateCompact,
} = await import('../lib/snapshot/snapshot/backgroundSnapshot.js');
const { snapshotManager } = await import('../lib/snapshot/snapshot/definition.js');
const { DynamicPartType } = await import('../lib/snapshot/snapshot/dynamicPartType.js');
const {
  SnapshotInstance,
  snapshotInstanceManager,
} = await import('../lib/snapshot/snapshot/snapshot.js');

const ROW_COUNTS = [1_000, 10_000, 30_000];
const ITERATIONS = 7;
const WARMUP_ITERATIONS = 2;
const LIST_TYPE = '__snapshot_first_screen_list';
const ROW_TYPE = '__snapshot_first_screen_row';

function collectGarbage() {
  globalThis.gc?.();
}

snapshotManager.values.set(LIST_TYPE, {
  create: null,
  update: [],
  slot: [[DynamicPartType.Children, 0]],
});
snapshotManager.values.set(ROW_TYPE, {
  create: null,
  update: [],
  slot: [[DynamicPartType.SlotV2, 0], [DynamicPartType.SlotV2, 0]],
  isSlotV2: true,
});

function createMainThreadSnapshot(rows) {
  const root = new SnapshotInstance('root', -1);
  const list = new SnapshotInstance(LIST_TYPE, -2);
  root.__insertBefore(list);
  let nextId = -3;
  for (let index = 0; index < rows; index++) {
    const rowId = nextId--;
    const row = new SnapshotInstance(ROW_TYPE, rowId);
    row.__values = [index, `row-${index}`, `${rowId}:2:`];
    list.__insertBefore(row);

    const title = new SnapshotInstance(null, nextId--);
    title.__values = [`Title ${index}`];
    row.__insertBefore(title);

    const body = new SnapshotInstance(null, nextId--);
    body.__values = [`Body ${index}`];
    body.__slotIndex = 1;
    row.__insertBefore(body);
  }
  return root;
}

function createBackgroundSnapshot(rows) {
  const root = new BackgroundSnapshotInstance('root');
  const list = new BackgroundSnapshotInstance(LIST_TYPE);
  root.insertBefore(list);
  for (let index = 0; index < rows; index++) {
    const row = new BackgroundSnapshotInstance(ROW_TYPE);
    row.__values = [index, `row-${index}`, () => undefined];
    list.insertBefore(row);

    const title = new BackgroundSnapshotInstance(null);
    title.__values = [`Title ${index}`];
    row.insertBefore(title);

    const body = new BackgroundSnapshotInstance(null);
    body.__values = [`Body ${index}`];
    body.__slotIndex = 1;
    row.insertBefore(body);
  }
  return root;
}

function makeEnvelope(root) {
  return JSON.stringify([
    'dispatchCoreContextOnBackground',
    [{
      type: '__OnLifecycleEvent',
      data: ['rLynxFirstScreen', {
        root,
        firstScreenEventIdSwap: {},
      }],
    }],
  ]);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function measure(callback) {
  for (let index = 0; index < WARMUP_ITERATIONS; index++) {
    callback();
  }
  const samples = [];
  let result;
  for (let index = 0; index < ITERATIONS; index++) {
    collectGarbage();
    const start = performance.now();
    result = callback();
    samples.push(performance.now() - start);
  }
  return { milliseconds: median(samples), result };
}

function measureWithSetup(setup, callback) {
  for (let index = 0; index < WARMUP_ITERATIONS; index++) {
    callback(setup());
  }
  const samples = [];
  let result;
  for (let index = 0; index < ITERATIONS; index++) {
    const input = setup();
    collectGarbage();
    const start = performance.now();
    result = callback(input);
    samples.push(performance.now() - start);
  }
  return { milliseconds: median(samples), result };
}

function createFreshBackgroundSnapshot(rows) {
  backgroundSnapshotInstanceManager.clear();
  backgroundSnapshotInstanceManager.nextId = 0;
  return createBackgroundSnapshot(rows);
}

console.log('Production Snapshot first-screen encode/parse/direct-hydrate measurement');
if (!globalThis.gc) {
  console.log('Run with `node --expose-gc` to reduce cross-sample allocation noise.');
}

const results = [];
for (const rows of ROW_COUNTS) {
  snapshotInstanceManager.clear();
  const snapshot = createMainThreadSnapshot(rows);
  const legacyRoot = JSON.stringify(snapshot);
  const compactRoot = stringifyCompactSnapshot(snapshot);
  const legacyEnvelope = makeEnvelope(legacyRoot);
  const compactEnvelope = makeEnvelope(compactRoot);
  const parsedLegacyRoot = JSON.parse(legacyRoot);
  const parsedCompactRoot = parseSnapshotSerialization(compactRoot);

  const legacyEncode = measure(() => JSON.stringify(snapshot));
  const compactEncode = measure(() => stringifyCompactSnapshot(snapshot));
  const legacyParse = measure(() => JSON.parse(legacyRoot));
  const compactParse = measure(() => parseSnapshotSerialization(compactRoot));

  const legacyHydrate = measureWithSetup(
    () => createFreshBackgroundSnapshot(rows),
    background => hydrate(parsedLegacyRoot, background),
  );
  const compactHydrate = measureWithSetup(
    () => createFreshBackgroundSnapshot(rows),
    background => hydrateCompact(parsedCompactRoot, background),
  );
  const legacyReceive = measureWithSetup(
    () => createFreshBackgroundSnapshot(rows),
    background => hydrate(JSON.parse(legacyRoot), background),
  );
  const compactReceive = measureWithSetup(
    () => createFreshBackgroundSnapshot(rows),
    background => hydrateCompact(parseSnapshotSerialization(compactRoot), background),
  );

  if (JSON.stringify(legacyHydrate.result) !== JSON.stringify(compactHydrate.result)) {
    throw new Error(`Hydration patch mismatch for ${rows} rows.`);
  }

  results.push({
    rows,
    nodes: 2 + rows * 3,
    legacyRootBytes: Buffer.byteLength(legacyRoot),
    compactRootBytes: Buffer.byteLength(compactRoot),
    legacyEnvelopeBytes: Buffer.byteLength(legacyEnvelope),
    compactEnvelopeBytes: Buffer.byteLength(compactEnvelope),
    legacyEncodeMs: legacyEncode.milliseconds,
    compactEncodeMs: compactEncode.milliseconds,
    legacyParseMs: legacyParse.milliseconds,
    compactParseMs: compactParse.milliseconds,
    legacyHydrateMs: legacyHydrate.milliseconds,
    compactHydrateMs: compactHydrate.milliseconds,
    legacyReceiveMs: legacyReceive.milliseconds,
    compactReceiveMs: compactReceive.milliseconds,
  });

  backgroundSnapshotInstanceManager.clear();
  snapshotInstanceManager.clear();
}

console.table(results);
