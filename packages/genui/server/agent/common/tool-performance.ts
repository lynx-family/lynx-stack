// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

type PerformanceObserver = (
  event: string,
  details?: Record<string, unknown>,
) => void;

interface RequestContextScope {
  requestContext: unknown;
}

const observers = new WeakMap<object, PerformanceObserver>();

export function registerToolPerformanceObserver(
  scope: RequestContextScope,
  observer: PerformanceObserver | undefined,
): void {
  if (
    observer
    && typeof scope.requestContext === 'object'
    && scope.requestContext !== null
  ) {
    observers.set(scope.requestContext, observer);
  }
}

export function emitToolPerformanceEvent(
  scope: RequestContextScope,
  details: Record<string, unknown>,
): void {
  if (
    typeof scope.requestContext !== 'object'
    || scope.requestContext === null
  ) {
    return;
  }
  observers.get(scope.requestContext)?.('agent.tool.completed', details);
}
