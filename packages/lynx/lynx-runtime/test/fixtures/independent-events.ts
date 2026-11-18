// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { bindPage } from '../../src/bts.js';

interface CounterEvent {
  amount: number;
}

export function startIndependentEventDSL(
  render: (target: string, value: number) => void,
): () => void {
  const page = bindPage();
  let pageCount = 0;
  const componentCounts = new Map<string, number>();
  return page.setEventHandler<CounterEvent>(
    (handlerName, data, componentId) => {
      if (handlerName !== 'increment') return undefined;
      if (componentId === undefined) {
        pageCount += data.amount;
        render('page', pageCount);
        return pageCount;
      }
      const count = (componentCounts.get(componentId) ?? 0) + data.amount;
      componentCounts.set(componentId, count);
      render(componentId, count);
      return count;
    },
  );
}
