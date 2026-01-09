// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
globalThis.performanceResult = {};
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    // console.log(entry);
    globalThis.performanceResult[entry.entryType] = entry;
  });
});

observer.observe({ type: 'navigation', buffered: true });
observer.observe({ type: 'longtask', buffered: true });
observer.observe({ type: 'paint', buffered: true });
