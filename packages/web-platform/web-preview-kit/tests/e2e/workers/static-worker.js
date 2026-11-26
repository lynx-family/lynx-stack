// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// A substitute for `bundler-worker.js` that speaks the messages of
// `src/worker/messages.ts` and "builds" by emitting the fixture that the
// global setup built in Node. The test server serves that build under
// `/__fixture__/` and lists it in `/__fixture__/manifest.json`.

const FIXTURE = new URL('/__fixture__/', self.location.origin);

let files = {};
let current;
let builds = 0;

const post = message => self.postMessage(message);

async function emitBuild(generation, revision) {
  const { config } = current;
  post({ type: 'build-start', generation, revision });
  const started = performance.now();
  const names = await (await fetch(new URL('manifest.json', FIXTURE))).json();
  const cache = await caches.open(config.cacheName);
  const assets = [];
  for (const name of names) {
    const content = new Uint8Array(
      await (await fetch(new URL(name, FIXTURE))).arrayBuffer(),
    );
    assets.push({ name, size: content.byteLength });
    await cache.put(
      new Request(new URL(name, config.publicPath).href),
      new Response(content, {
        headers: {
          'Content-Type': name.endsWith('.js')
            ? 'text/javascript'
            : 'application/octet-stream',
        },
      }),
    );
  }
  builds += 1;
  if (current?.generation !== generation) {
    return;
  }
  post({
    type: 'build-done',
    generation,
    revision,
    report: {
      hash: `static${builds}`,
      durationMs: performance.now() - started,
      errors: [],
      warnings: [],
      cards: Object.entries(config.entries).map(([name, entry]) => ({
        name,
        entry,
        bundle: `${name}.web.bundle`,
      })),
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
    post({ type: 'reply', id: command.id, error: String(error) });
  }
});

post({ type: 'ready', builtinPackages: { '@lynx-js/react': 'fixture' } });
