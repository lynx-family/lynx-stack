// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// A substitute for `bundler-worker.js` that speaks the messages of
// `src/worker/messages.ts` and builds with real Rsbuild watch compilations in
// Node (`tests/node/dev-service.mjs`). Like the real worker, it writes the
// emitted assets of a build to CacheStorage before reporting the build.

const post = message => self.postMessage(message);
/** The bundler config of each generation. */
const configs = new Map();

function encode(content) {
  if (typeof content === 'string') {
    return content;
  }
  let binary = '';
  for (const byte of content) {
    binary += String.fromCharCode(byte);
  }
  return { base64: btoa(binary) };
}

function decode(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function serialize(command) {
  switch (command.type) {
    case 'start':
      return {
        ...command,
        files: command.files
          && Object.fromEntries(
            Object.entries(command.files).map((
              [name, content],
            ) => [name, encode(content)]),
          ),
      };
    case 'apply':
      return {
        ...command,
        changes: command.changes.map(change =>
          change.type === 'write'
            ? { ...change, content: encode(change.content) }
            : change
        ),
      };
    default:
      return command;
  }
}

function contentType(name) {
  if (/\.(m?js)$/.test(name)) return 'text/javascript; charset=utf-8';
  if (/\.(json|map)$/.test(name)) return 'application/json; charset=utf-8';
  if (/\.css$/.test(name)) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

let reporting = Promise.resolve();
const events = new EventSource('/__dev__/events');
events.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  reporting = reporting.then(async () => {
    if (message.type === 'build-start') {
      post(message);
      return;
    }
    const config = configs.get(message.generation);
    if (config) {
      const cache = await caches.open(config.cacheName);
      await Promise.all(message.emitted.map(({ name, base64 }) =>
        cache.put(
          new Request(new URL(name, config.publicPath).href),
          new Response(decode(base64), {
            headers: { 'Content-Type': contentType(name) },
          }),
        )
      ));
    }
    post({
      type: 'build-done',
      generation: message.generation,
      revision: message.revision,
      report: message.report,
    });
  }).catch(error => console.error(error));
});

self.addEventListener('message', async (event) => {
  const command = event.data;
  if (command.type === 'start') {
    configs.set(command.generation, command.config);
  }
  try {
    const response = await fetch('/__dev__/command', {
      method: 'POST',
      body: JSON.stringify(serialize(command)),
    });
    const { result, error } = await response.json();
    if (error !== undefined) {
      throw new Error(error);
    }
    post({
      type: 'reply',
      id: command.id,
      result: command.type === 'read' && result
        ? decode(result.base64)
        : result ?? undefined,
    });
  } catch (error) {
    post({ type: 'reply', id: command.id, error: String(error) });
  }
});

events.addEventListener('open', () => {
  post({ type: 'ready', builtinPackages: { '@lynx-js/react': 'node' } });
}, { once: true });
