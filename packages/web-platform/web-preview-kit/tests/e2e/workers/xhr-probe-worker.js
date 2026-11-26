// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Loads a URL with a synchronous XHR, as web-core's background thread loads
// hot updates, and reports what it got.
self.addEventListener('message', (event) => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', event.data, false);
  xhr.send(null);
  self.postMessage({
    status: xhr.status,
    text: xhr.responseText,
    crossOriginIsolated: self.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer === 'function',
  });
});
