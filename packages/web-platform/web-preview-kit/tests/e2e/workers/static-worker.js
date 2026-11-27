// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// A substitute for `bundler-worker.js` that speaks the messages of
// `src/worker/messages.ts` and "builds" by emitting the fixture that the
// global setup built in Node. The test server serves that build under
// `/__fixture__/` and lists it in `/__fixture__/manifest.json`.
//
// Every build also emits `<card>.<hash>.hot-update.json`, as a development
// build does. A project can steer its builds with a file
// `static-worker.json`, read at the start of each build:
//
// - `errors`: messages; the build fails with them and, like a failed Rspack
//   build, overwrites the card bundles with broken ones.
// - `delayMs`: how long the build takes.
// - `crash`: the next `list` command throws an uncaught error instead of
//   answering, as a worker that crashes does.
//
// Like the bundle kit, a `rename` of a missing file fails.

const FIXTURE = new URL('/__fixture__/', self.location.origin);
const CONTROL_FILE = 'static-worker.json';

let files = {};
let current;
let builds = 0;

const post = message => self.postMessage(message);
const decoder = new TextDecoder();

function control() {
  const content = files[CONTROL_FILE];
  if (content === undefined) {
    return {};
  }
  return JSON.parse(
    typeof content === 'string' ? content : decoder.decode(content),
  );
}

async function emitBuild(generation, revision) {
  const { config } = current;
  const { errors = [], delayMs = 0 } = control();
  post({ type: 'build-start', generation, revision });
  const started = performance.now();
  builds += 1;
  const hash = `static${builds}`;
  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  const names = await (await fetch(new URL('manifest.json', FIXTURE))).json();
  const cards = Object.entries(config.entries).map(([name, entry]) => ({
    name,
    entry,
    bundle: `${name}.web.bundle`,
  }));
  const cache = await caches.open(config.cacheName);
  const assets = [];
  const store = async (name, content, type) => {
    assets.push({ name, size: content.byteLength });
    await cache.put(
      new Request(new URL(name, config.publicPath).href),
      new Response(content, { headers: { 'Content-Type': type } }),
    );
  };
  for (const name of names) {
    const content = errors.length > 0 && name.endsWith('.web.bundle')
      ? new TextEncoder().encode('broken')
      : new Uint8Array(
        await (await fetch(new URL(name, FIXTURE))).arrayBuffer(),
      );
    await store(
      name,
      content,
      name.endsWith('.js') ? 'text/javascript' : 'application/octet-stream',
    );
  }
  for (const card of cards) {
    await store(
      `${card.name}.${hash}.hot-update.json`,
      new TextEncoder().encode('{}'),
      'application/json',
    );
  }
  if (current?.generation !== generation) {
    return;
  }
  post({
    type: 'build-done',
    generation,
    revision,
    report: {
      hash,
      durationMs: performance.now() - started,
      errors: errors.map(message => ({ message })),
      warnings: [],
      cards,
      assets,
    },
  });
}

function apply(changes) {
  for (const change of changes) {
    if (change.type === 'write') {
      files[change.path] = change.content;
    } else if (change.type === 'delete') {
      for (const path of Object.keys(files)) {
        if (path === change.path || path.startsWith(`${change.path}/`)) {
          delete files[path];
        }
      }
    } else {
      if (!(change.from in files)) {
        throw new Error(`Cannot rename "${change.from}": it does not exist`);
      }
      files[change.to] = files[change.from];
      delete files[change.from];
    }
  }
}

async function handle(command) {
  switch (command.type) {
    case 'start':
      files = command.files ?? files;
      current = { generation: command.generation, config: command.config };
      void emitBuild(command.generation, command.revision);
      return undefined;
    case 'apply':
      apply(command.changes);
      void emitBuild(current.generation, command.revision);
      return undefined;
    case 'read': {
      const content = files[command.path];
      return content === undefined
        ? null
        : typeof content === 'string'
        ? new TextEncoder().encode(content)
        : content;
    }
    case 'list':
      if (control().crash) {
        setTimeout(() => {
          throw new Error('the bundler crashed');
        }, 0);
        return new Promise(() => {});
      }
      return Object.keys(files).sort();
    case 'close':
      current = undefined;
      return undefined;
  }
}

self.addEventListener('message', async (event) => {
  const command = event.data;
  try {
    post({ type: 'reply', id: command.id, result: await handle(command) });
  } catch (error) {
    post({
      type: 'reply',
      id: command.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

post({ type: 'ready', builtinPackages: { '@lynx-js/react': 'fixture' } });
