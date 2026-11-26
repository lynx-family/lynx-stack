// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Runs the built kit in a module Worker and answers calls from the page.
import { builtinPackages, createWebBundler } from '/dist/index.js';

let bundler;
const events = [];

const handlers = {
  async create(options) {
    if (bundler) await bundler.close();
    bundler = await createWebBundler(options);
    return { builtinPackages };
  },
  build: () => bundler.build(),
  async watch() {
    events.length = 0;
    await bundler.watch((event) => {
      events.push(event);
      postMessage({ event });
    });
    return null;
  },
  applyChanges: (changes) => bundler.applyChanges(changes),
  readFile: (path) => bundler.readFile(path),
  listFiles: () => bundler.listFiles(),
  events: () => events,
  async close() {
    await bundler?.close();
    bundler = undefined;
    return null;
  },
};

addEventListener('message', async ({ data: { id, method, args } }) => {
  try {
    const result = await handlers[method](...args);
    postMessage({ id, result });
  } catch (error) {
    postMessage({ id, error: String(error?.stack ?? error) });
  }
});
