import type {
  LoadBundleEntry,
  PerformanceObserver as LynxPerformanceObserver,
  PerformanceEntry,
  PipelineEntry,
} from '@lynx-js/types/background';

import type {
  CounterPatch,
  PerformancePatch,
  PipelineOptions,
} from './events.js';
import {
  counterTimingFlagPrefix,
  counterUpdatedEventName,
  destroyLifetimeEventName,
  incrementCounterEventName,
  performanceUpdatedEventName,
} from './events.js';

const mainThread = lynx.getCoreContext();

let count = 0;
let performanceObserver: LynxPerformanceObserver | undefined;
const pendingUpdates = new Set<string>();

function formatMilliseconds(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(2)} ms`
    : 'n/a';
}

function formatDuration(start: unknown, end: unknown): string {
  if (
    typeof start !== 'number'
    || typeof end !== 'number'
    || !Number.isFinite(start)
    || !Number.isFinite(end)
    || end < start
  ) {
    return 'n/a';
  }
  return formatMilliseconds(end - start);
}

function reportPerformance(
  patch: PerformancePatch,
): void {
  mainThread.dispatchEvent({
    type: performanceUpdatedEventName,
    data: patch,
  });
}

function reportInitialRender(entry: LoadBundleEntry): void {
  reportPerformance({
    kind: 'initialRender',
    summary: `Initial render: Lynx FCP ${
      formatMilliseconds(entry.lynxFcp.duration)
    }`,
  });
}

function beginUpdatePipeline(timingFlag: string): PipelineOptions | undefined {
  if (
    typeof lynx.performance._generatePipelineOptions !== 'function'
    || typeof lynx.performance._onPipelineStart !== 'function'
    || typeof lynx.performance._bindPipelineIdWithTimingFlag !== 'function'
  ) {
    console.warn('[performance] Pipeline timing APIs are unavailable.');
    return undefined;
  }

  const pipelineOptions = lynx.performance._generatePipelineOptions();
  pipelineOptions.needTimestamps = true;
  pipelineOptions.pipelineOrigin = 'updateTriggeredByBts';
  pipelineOptions.dsl = 'vanilla';
  pipelineOptions.stage = 'update';
  pipelineOptions.timingFlag = timingFlag;

  lynx.performance._onPipelineStart(
    pipelineOptions.pipelineID,
    pipelineOptions,
  );
  lynx.performance._bindPipelineIdWithTimingFlag(
    pipelineOptions.pipelineID,
    timingFlag,
  );
  return pipelineOptions;
}

function reportPipelineUpdate(entry: PipelineEntry): void {
  if (!pendingUpdates.has(entry.identifier)) {
    return;
  }

  pendingUpdates.delete(entry.identifier);
  reportPerformance({
    kind: 'update',
    summary: `Update: Pipeline ${
      formatDuration(entry.pipelineStart, entry.pipelineEnd)
    }`,
  });
}

function onPerformanceEntry(entry: PerformanceEntry): void {
  console.info(
    `[performance] ${entry.entryType}.${entry.name}: ${JSON.stringify(entry)}`,
  );

  if (entry.entryType !== 'pipeline') {
    return;
  }

  if (entry.name === 'loadBundle') {
    reportInitialRender(entry as LoadBundleEntry);
    return;
  }

  reportPipelineUpdate(entry as PipelineEntry);
}

function setupPerformanceObserver(): void {
  if (typeof lynx.performance?.createObserver !== 'function') {
    console.warn('[performance] PerformanceObserver is unavailable.');
    return;
  }

  performanceObserver = lynx.performance.createObserver(onPerformanceEntry);
  performanceObserver.observe(['pipeline']);
}

function onIncrementCounter(): void {
  const nextCount = count + 1;
  const timingFlag = `${counterTimingFlagPrefix}${nextCount}`;
  const pipelineOptions = beginUpdatePipeline(timingFlag);
  console.info(
    `[performance] beginUpdatePipeline: ${JSON.stringify(pipelineOptions)}`,
  );
  if (!pipelineOptions) {
    return;
  }

  count = nextCount;
  pendingUpdates.add(timingFlag);

  const patch: CounterPatch = { count, pipelineOptions };
  mainThread.dispatchEvent({
    type: counterUpdatedEventName,
    data: patch,
  });
}

function cleanup(): void {
  performanceObserver?.disconnect();
  performanceObserver = undefined;
  pendingUpdates.clear();
  mainThread.removeEventListener(
    incrementCounterEventName,
    onIncrementCounter,
  );
  mainThread.removeEventListener(destroyLifetimeEventName, cleanup);
}

setupPerformanceObserver();
mainThread.addEventListener(incrementCounterEventName, onIncrementCounter);
mainThread.addEventListener(destroyLifetimeEventName, cleanup);
