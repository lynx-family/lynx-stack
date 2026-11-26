// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The page side of the e2e test: talks to the kit's Worker and renders
// bundles in <lynx-view>, and sends the card the signals of a dev server.
const worker = new Worker('/e2e/worker.js', { type: 'module' });
let nextId = 0;
const pending = new Map();
window.kitEvents = [];
worker.addEventListener('message', ({ data }) => {
  if (data.event) {
    window.kitEvents.push(data.event);
    return;
  }
  const { resolve, reject } = pending.get(data.id);
  pending.delete(data.id);
  if (data.error) reject(new Error(data.error));
  else resolve(data.result);
});
worker.addEventListener(
  'error',
  (event) => console.error('worker error', event.message),
);

window.kit = (method, ...args) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, method, args });
  });

// `NativeModules.LynxDevToolSetModule` for the card: the HMR client calls
// `invokeCdp('Page.reload')` when it cannot apply an update. The test records
// the call instead of reloading, so a failed hot update stays visible.
const DEVTOOL_SET_MODULE = URL.createObjectURL(
  new Blob([
    `export default function(NativeModules, NativeModulesCall) {
  return {
    invokeCdp(message, callback) {
      Promise.resolve(NativeModulesCall('invokeCdp', message)).then((result) => {
        if (typeof callback === 'function') callback(result);
      });
    },
  };
}
`,
  ], { type: 'text/javascript' }),
);
window.cardEvents = [];

window.render = (url) => {
  document.querySelector('lynx-view')?.remove();
  window.cardEvents = [];
  const view = document.createElement('lynx-view');
  view.nativeModulesMap = { LynxDevToolSetModule: DEVTOOL_SET_MODULE };
  view.onNativeModulesCall = (name, message) => {
    window.cardEvents.push({ type: name, message: String(message) });
    const { id } = JSON.parse(String(message));
    return JSON.stringify({ id, result: {} });
  };
  view.addEventListener('error', (event) => {
    const error = event.detail?.error;
    window.cardEvents.push({
      type: 'error',
      message: String(error?.message ?? error ?? 'error'),
    });
  });
  view.setAttribute('url', url);
  document.body.append(view);
  return view;
};

// What a dev server sends after a rebuild: `hash`, then `ok`. The HMR client
// (`LynxTransportClient`) reads them from `lynx.getDevtool()` as CDP messages.
window.hotUpdate = (hash) => {
  const view = document.querySelector('lynx-view');
  for (const message of [{ type: 'hash', data: hash }, { type: 'ok' }]) {
    view.sendDevtoolEvent('message', {
      type: 'message',
      message: JSON.stringify({
        method: 'message',
        params: { data: JSON.stringify(message) },
      }),
    });
  }
};
window.ready = true;
