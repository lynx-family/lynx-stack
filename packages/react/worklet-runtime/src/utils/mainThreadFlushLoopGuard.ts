// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const TRACE_LIMIT = 256;
const DEFAULT_FLUSH_LIMIT = 256;

let trace: string[] = [];

let flushCountInWindow = 0;
let resetScheduled = false;
let trippedError: Error | null = null;

function pushTrace(marker: string): void {
  trace.push(marker);
  if (trace.length > TRACE_LIMIT) {
    trace = trace.slice(trace.length - TRACE_LIMIT);
  }
}

function compressTrace(markers: string[]): string {
  if (markers.length === 0) return '';
  const out: string[] = [];
  // Display most-recent-first to make loops easier to read.
  let prev = markers[markers.length - 1]!;
  let count = 1;

  for (let i = markers.length - 2; i >= 0; i--) {
    const cur = markers[i]!;
    if (cur === prev) {
      count++;
      continue;
    }
    out.push(count === 1 ? prev : `${prev} x${count}`);
    prev = cur;
    count = 1;
  }
  out.push(count === 1 ? prev : `${prev} x${count}`);
  return out.join(' <- ');
}

export function mainThreadFlushLoopMark(marker: string): void {
  if (__DEV__) {
    pushTrace(marker);
  }
}

export function mainThreadFlushLoopOnFlushMicrotask(): Error | null {
  /* v8 ignore next 1 */
  if (!__DEV__) return null;
  if (trippedError) return trippedError;

  if (!resetScheduled) {
    resetScheduled = true;
    setTimeout(() => {
      mainThreadFlushLoopReset();
    }, 0);
  }

  flushCountInWindow++;
  const limit = DEFAULT_FLUSH_LIMIT;
  if (flushCountInWindow > limit) {
    const traceText = compressTrace(trace);
    trippedError = new Error(
      `[ReactLynx][DEV] MainThread flush loop detected: render executed ${flushCountInWindow} times without yielding (limit=${limit}). Trace: ${traceText}`,
    );
    return trippedError;
  }

  return null;
}

export function mainThreadFlushLoopReport(error: Error): void {
  if (__DEV__) {
    // Throw on macrotask to avoid Promise-unhandled-rejection noise.
    setTimeout(() => {
      throw error;
    }, 0);
  }
}

export function mainThreadFlushLoopReset(): void {
  trace = [];
  flushCountInWindow = 0;
  resetScheduled = false;
  trippedError = null;
}
