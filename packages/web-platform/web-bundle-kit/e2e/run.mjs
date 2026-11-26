// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// End-to-end test of the built kit (`dist/`) in Chromium.
//
// Serves the kit, web-core's client and a test page from a fake origin with
// COOP/COEP headers, builds the fixture project in a Worker and checks the
// result: a production build, its rendering in <lynx-view>, development
// rebuilds with hot updates applied in the rendered card, error recovery, and
// the project's own `node_modules` winning over the kit's mirror.
//
// Usage: node e2e/run.mjs   (after building the kit)

import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildInNode } from './node-build.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('@playwright/test');
const webCoreClient = path.join(
  path.dirname(require.resolve('@lynx-js/web-core/package.json')),
  'dist/client_prod',
);

// localhost is a trustworthy origin, so COOP applies; requests never leave
// Playwright (page.route answers them).
const ORIGIN = 'http://localhost:4100';
const PUBLIC_PATH = `${ORIGIN}/out/`;
const TYPES = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.html': 'text/html',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
};

/** Assets of the latest builds, served under /out/. */
const served = new Map();

function readFixture() {
  const dir = path.join(here, 'fixture');
  const files = {};
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const file = path.join(d, name);
      if (statSync(file).isDirectory()) walk(file);
      else files[path.relative(dir, file).split(path.sep).join('/')] = file;
    }
  };
  walk(dir);
  return files;
}

function serveFile(route, file, headers) {
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    return route.fulfill({ status: 404, headers, body: 'not found' });
  }
  return route.fulfill({
    status: 200,
    headers: {
      ...headers,
      'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    },
    body: readFileSync(file),
  });
}

const results = [];
async function step(name, fn) {
  if (process.env.KIT_E2E_BAIL && results.some((r) => !r.ok)) return;
  const start = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(
      `PASS ${name} (${Date.now() - start} ms)${
        detail ? `\n     ${detail}` : ''
      }`,
    );
  } catch (error) {
    results.push({ name, ok: false });
    console.log(
      `FAIL ${name} (${Date.now() - start} ms)\n     ${
        String(error?.stack ?? error).replaceAll('\n', '\n     ')
      }`,
    );
  }
}

const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage();
const headers = {
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-embedder-policy': 'require-corp',
  'cross-origin-resource-policy': 'cross-origin',
};
await page.route(`${ORIGIN}/**`, (route) => {
  const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
  if (pathname === '/' || pathname === '/index.html') {
    return serveFile(route, path.join(here, 'page/index.html'), headers);
  }
  if (pathname.startsWith('/e2e/')) {
    return serveFile(
      route,
      path.join(here, 'page', pathname.slice(5)),
      headers,
    );
  }
  if (pathname.startsWith('/dist/')) {
    return serveFile(
      route,
      path.join(root, 'dist', pathname.slice(6)),
      headers,
    );
  }
  if (pathname.startsWith('/web-core/')) {
    return serveFile(
      route,
      path.join(webCoreClient, pathname.slice(10)),
      headers,
    );
  }
  if (pathname.startsWith('/out/')) {
    const content = served.get(pathname.slice(5));
    if (!content) {
      return route.fulfill({ status: 404, headers, body: 'not built' });
    }
    return route.fulfill({
      status: 200,
      headers: {
        ...headers,
        'content-type': TYPES[path.extname(pathname)]
          ?? 'application/octet-stream',
      },
      body: content,
    });
  }
  return route.fulfill({ status: 404, headers, body: 'not found' });
});
const consoleLines = [];
/** Requests for built assets, for failure messages. */
const requested = [];
page.on('request', (request) => {
  if (request.url().startsWith(PUBLIC_PATH)) {
    requested.push(request.url().slice(PUBLIC_PATH.length));
  }
});
page.on(
  'console',
  (message) => consoleLines.push(`[${message.type()}] ${message.text()}`),
);
page.on(
  'pageerror',
  (error) => consoleLines.push(`[pageerror] ${error.message}`),
);
page.on('worker', (worker) => {
  worker.on(
    'console',
    (message) =>
      consoleLines.push(`[worker ${message.type()}] ${message.text()}`),
  );
});
await page.goto(`${ORIGIN}/index.html`);
await page.waitForFunction(() => window.ready === true);

const fixture = readFixture();
const fixtureFiles = Object.fromEntries(
  Object.entries(fixture).map(([name, file]) => [
    name,
    name.endsWith('.png')
      ? [...readFileSync(file)]
      : readFileSync(file, 'utf-8'),
  ]),
);

/** Calls the kit in the Worker. Binary contents travel as number arrays. */
async function kit(method, ...args) {
  return page.evaluate(
    async ({ method, args }) => {
      const revive = (value) =>
        value && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(
            Object.entries(value).map((
              [k, v],
            ) => [
              k,
              Array.isArray(v) && typeof v[0] === 'number'
                ? new Uint8Array(v)
                : revive(v),
            ]),
          )
          : value;
      const result = await window.kit(
        method,
        ...args.map((
          arg,
        ) => (Array.isArray(arg) ? arg.map(revive) : revive(arg))),
      );
      const plain = (value) => {
        if (value instanceof Uint8Array) {
          return {
            base64: btoa(
              Array.from(value, (b) => String.fromCharCode(b)).join(''),
            ),
          };
        }
        if (Array.isArray(value)) return value.map(plain);
        if (value && typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, plain(v)]),
          );
        }
        return value;
      };
      return plain(result);
    },
    { method, args },
  );
}

const bytes = (value) => Buffer.from(value.base64, 'base64');
function serve(result) {
  for (const asset of result.emitted) {
    served.set(asset.name, bytes(asset.content));
  }
}
const text = (result, predicate) =>
  result.emitted.filter((a) => predicate(a.name)).map((a) =>
    bytes(a.content).toString('utf-8')
  ).join('\n');

const timings = {};

/**
 * Names shaped `__name__` in the JavaScript of a set of files: the names
 * bundlers and runtimes use (`__webpack_require__`,
 * `__nested_rspack_require_<n>_<m>__`, ...).
 */
function dunderNames(texts) {
  const names = new Set();
  for (const text of texts) {
    for (const name of text.match(/\b__[\w$]+__\b/g) ?? []) names.add(name);
  }
  return names;
}

let prod;
await step('production build()', async () => {
  const createStart = Date.now();
  const created = await kit('create', {
    entries: { main: 'src/main/index.tsx', detail: 'src/detail/index.tsx' },
    publicPath: PUBLIC_PATH,
    mode: 'production',
    files: fixtureFiles,
  });
  // The first create() loads Rspack's wasm and the mirror.
  timings.firstCreate = Date.now() - createStart;
  assert.equal(created.builtinPackages['@lynx-js/react'] !== undefined, true);
  const start = Date.now();
  prod = await kit('build');
  timings.productionBuild = {
    wall: Date.now() - start,
    reported: prod.durationMs,
  };
  assert.deepEqual(prod.errors, [], JSON.stringify(prod.errors, null, 2));
  assert.deepEqual(prod.cards, [
    { name: 'main', entry: 'src/main/index.tsx', bundle: 'main.web.bundle' },
    {
      name: 'detail',
      entry: 'src/detail/index.tsx',
      bundle: 'detail.web.bundle',
    },
  ]);
  const names = prod.assets.map((a) => a.name);
  assert.ok(
    names.includes('main.web.bundle') && names.includes('detail.web.bundle'),
    names.join(', '),
  );
  assert.ok(
    names.some((n) => n.endsWith('.png')),
    `an image asset: ${names.join(', ')}`,
  );
  assert.equal(prod.emitted.length, prod.assets.length);
  for (const asset of prod.assets) {
    const emitted = prod.emitted.find((e) => e.name === asset.name);
    assert.equal(bytes(emitted.content).length, asset.size, asset.name);
  }
  serve(prod);
  return `${prod.durationMs} ms in Rspack, ${
    Date.now() - start
  } ms in all; assets: ${
    prod.assets.map((a) => `${a.name} (${a.size})`).join(', ')
  }; warnings: ${prod.warnings.length}${
    process.env.KIT_E2E_VERBOSE
      ? `\n${
        [...new Set(prod.warnings.map((w) => w.message.slice(0, 300)))].slice(
          0,
          5,
        ).join('\n---\n')
      }`
      : ''
  }`;
});

await step('production bundle renders in <lynx-view>', async () => {
  await page.evaluate(
    (url) => window.render(url),
    `${PUBLIC_PATH}main.web.bundle`,
  );
  const handle = await page.waitForFunction(
    () => {
      const root = document.querySelector('lynx-view')?.shadowRoot;
      if (!root) return false;
      const all = [...root.querySelectorAll('*')];
      const title = all.find((el) =>
        el.textContent?.trim() === 'Hello from the web bundle kit'
        && el.children.length === 0
      );
      const badge = all.find((el) =>
        el.textContent?.trim() === 'css module' && el.children.length === 0
      );
      const image = all.find((el) =>
        el.tagName.toLowerCase().includes('image')
      );
      if (!title || !badge) return false;
      const owner = (el) => el.closest('x-text') ?? el.parentElement ?? el;
      return {
        title: getComputedStyle(owner(title)).color,
        titleSize: getComputedStyle(owner(title)).fontSize,
        badge: getComputedStyle(owner(badge)).color,
        image: image ? image.getAttribute('src') : null,
      };
    },
    null,
    { timeout: 30_000 },
  );
  const styles = await handle.jsonValue();
  assert.equal(styles.title, 'rgb(255, 0, 0)', JSON.stringify(styles));
  assert.equal(styles.badge, 'rgb(0, 128, 0)', JSON.stringify(styles));
  assert.ok(
    styles.image?.startsWith(PUBLIC_PATH) && styles.image.endsWith('.png'),
    JSON.stringify(styles),
  );
  return JSON.stringify(styles);
});

const waitForDone = async (count) => {
  await page.waitForFunction(
    (n) => window.kitEvents.filter((e) => e.type === 'done').length >= n,
    count,
    {
      timeout: 120_000,
    },
  );
  // Nothing else may follow within a short while.
  await page.waitForTimeout(500);
  return page.evaluate(() =>
    window.kitEvents.map((
      e,
    ) => (e.type === 'done' ? { type: 'done', result: e.result } : e))
  );
};
const lastDone = async () => {
  const events = await kit('events');
  return events.filter((e) => e.type === 'done').at(-1).result;
};
const countEvents = async () => {
  const events = await page.evaluate(() => window.kitEvents.map((e) => e.type));
  return {
    start: events.filter((t) => t === 'start').length,
    done: events.filter((t) => t === 'done').length,
  };
};

await step('development watch() with hmr: first build', async () => {
  await kit('create', {
    entries: { main: 'src/main/index.tsx', detail: 'src/detail/index.tsx' },
    publicPath: PUBLIC_PATH,
    mode: 'development',
    hmr: true,
    files: fixtureFiles,
  });
  await page.evaluate(() => {
    window.kitEvents = [];
  });
  const start = Date.now();
  await kit('watch');
  await waitForDone(1);
  timings.developmentFirstBuild = Date.now() - start;
  timings.developmentFirstBuildRspack = (await lastDone()).durationMs;
  const result = await lastDone();
  assert.deepEqual(result.errors, [], JSON.stringify(result.errors, null, 2));
  assert.deepEqual(await countEvents(), { start: 1, done: 1 });
  assert.equal(result.cards.length, 2);
  const bundle = bytes(
    result.emitted.find((a) => a.name === 'main.web.bundle').content,
  ).toString('latin1');
  assert.ok(
    bundle.includes('LynxTransportClient') || bundle.includes('getDevtool'),
    'HMR client uses lynx.getDevtool()',
  );
  assert.ok(
    !bundle.includes('new WebSocket('),
    'no WebSocket in the dev bundle',
  );
  // Runtime code the plugins inject by stringifying functions must reach the
  // card as published, not as the kit's own bundling rewrote it (see
  // `STRINGIFIED` in scripts/build.mjs): the cards must use the same
  // `__name__` identifiers as the same project built in Node.js.
  const nodeOut = mkdtempSync(path.join(os.tmpdir(), 'web-bundle-kit-e2e-'));
  let reference;
  try {
    await buildInNode({
      root: path.join(here, 'fixture'),
      entries: { main: 'src/main/index.tsx', detail: 'src/detail/index.tsx' },
      outDir: nodeOut,
      publicPath: PUBLIC_PATH,
      mode: 'development',
      hmr: true,
    });
    reference = dunderNames(
      ['main.web.bundle', 'detail.web.bundle'].map((name) =>
        readFileSync(path.join(nodeOut, name), 'latin1')
      ),
    );
  } finally {
    rmSync(nodeOut, { recursive: true, force: true });
  }
  const names = dunderNames(
    result.emitted.filter((a) => a.name.endsWith('.web.bundle')).map((a) =>
      bytes(a.content).toString('latin1')
    ),
  );
  serve(result);
  assert.deepEqual(
    {
      onlyInKit: [...names].filter((n) => !reference.has(n)),
      onlyInNode: [...reference].filter((n) => !names.has(n)),
    },
    { onlyInKit: [], onlyInNode: [] },
    'the cards use the identifiers of a Node.js build',
  );
  return `${result.durationMs} ms in Rspack; ${result.assets.length} assets`;
});

await step('dev bundle starts without a WebSocket', async () => {
  const sockets = [];
  page.on('websocket', (ws) => sockets.push(ws.url()));
  const before = consoleLines.length;
  const requestedBefore = requested.length;
  // <lynx-view> caches templates by URL: a new URL, or it renders the
  // production bundle again.
  await page.evaluate(
    (url) => window.render(url),
    `${PUBLIC_PATH}main.web.bundle?development`,
  );
  await page.waitForFunction(
    () => {
      const root = document.querySelector('lynx-view')?.shadowRoot;
      return root
        && [...root.querySelectorAll('*')].some((el) =>
          el.textContent?.trim() === 'Hello from the web bundle kit'
        );
    },
    null,
    { timeout: 30_000 },
  );
  assert.deepEqual(sockets, []);
  assert.ok(
    requested.slice(requestedBefore).includes('main.web.bundle?development'),
    'the development bundle is loaded',
  );
  const errors = consoleLines.slice(before).filter((l) =>
    /\[error\]|pageerror/.test(l)
  );
  return errors.length
    ? `console errors: ${errors.join(' | ').slice(0, 500)}`
    : 'no console errors';
});

/**
 * Sends the rendered dev card the signals of a dev server for `hash`, waits
 * until `applied` (run in the page) holds, and checks that the HMR client
 * neither failed nor asked for a reload.
 */
async function hotUpdate(hash, applied, arg) {
  const before = consoleLines.length;
  const requestedBefore = requested.length;
  await page.evaluate((h) => window.hotUpdate(h), hash);
  try {
    await page.waitForFunction(applied, arg, { timeout: 30_000 });
  } catch (error) {
    const events = await page.evaluate(() => window.cardEvents);
    throw new Error(
      `${error.message}\ncard events: ${JSON.stringify(events)}\nrequested: ${
        requested.slice(requestedBefore).join(', ')
      }\nconsole: ${consoleLines.slice(before).join('\n').slice(0, 2000)}`,
    );
  }
  await page.waitForTimeout(500);
  const events = await page.evaluate(() => window.cardEvents);
  assert.deepEqual(events, [], 'no reload request and no error');
  const thrown = consoleLines.slice(before).filter((line) =>
    /is not defined|\[HMR\].*(fail|abort)|pageerror/i.test(line)
  );
  assert.deepEqual(thrown, []);
}

/** The text and the color of the fixture's title in the rendered card. */
const titleIs = ({ text, color }) => {
  const root = document.querySelector('lynx-view')?.shadowRoot;
  if (!root) return false;
  const el = [...root.querySelectorAll('*')].find((e) =>
    e.children.length === 0 && e.textContent?.trim() === text
  );
  if (!el) return false;
  const owner = el.closest('x-text') ?? el.parentElement ?? el;
  return color === undefined || getComputedStyle(owner).color === color;
};

const hotFiles = (result) =>
  result.emitted.map((a) => a.name).filter((n) => n.includes('hot-update'));

let cssResult;
await step('CSS edit: one rebuild with hot updates', async () => {
  const before = await countEvents();
  const start = Date.now();
  await kit('applyChanges', [{
    type: 'write',
    path: 'src/main/App.css',
    content: fixtureFiles['src/main/App.css'].replace(
      'rgb(255, 0, 0)',
      'rgb(0, 0, 255)',
    ),
  }]);
  await waitForDone(before.done + 1);
  timings.cssRebuild = Date.now() - start;
  timings.cssRebuildRspack = (await lastDone()).durationMs;
  const after = await countEvents();
  assert.deepEqual(after, { start: before.start + 1, done: before.done + 1 });
  const result = await lastDone();
  assert.deepEqual(result.errors, []);
  const hot = hotFiles(result);
  assert.ok(
    hot.some((n) =>
      n.endsWith('.hot-update.json') && !n.endsWith('.css.hot-update.json')
    ),
    `manifest: ${hot}`,
  );
  assert.ok(hot.some((n) => n.endsWith('.hot-update.js')), `chunk: ${hot}`);
  assert.ok(hot.some((n) => n.endsWith('.css.hot-update.json')), `css: ${hot}`);
  const cssUpdate = text(result, (n) => n.endsWith('.css.hot-update.json'));
  assert.ok(cssUpdate.length > 0);
  serve(result);
  cssResult = result;
  return `${result.durationMs} ms in Rspack; emitted ${
    result.emitted.map((a) => a.name).join(', ')
  }`;
});

await step('CSS hot update is applied in the dev card', async () => {
  assert.ok(cssResult, 'the CSS rebuild succeeded');
  await hotUpdate(cssResult.hash, titleIs, {
    text: 'Hello from the web bundle kit',
    color: 'rgb(0, 0, 255)',
  });
  return `title is blue after hash ${cssResult.hash}, no reload`;
});

let tsxResult;
await step('TSX edit: one rebuild with hot updates', async () => {
  const before = await countEvents();
  const start = Date.now();
  await kit('applyChanges', [{
    type: 'write',
    path: 'src/main/App.tsx',
    content: fixtureFiles['src/main/App.tsx'].replace(
      'Hello from the web bundle kit',
      'Hello again',
    ),
  }]);
  await waitForDone(before.done + 1);
  timings.tsxRebuild = Date.now() - start;
  timings.tsxRebuildRspack = (await lastDone()).durationMs;
  assert.deepEqual(await countEvents(), {
    start: before.start + 1,
    done: before.done + 1,
  });
  const result = await lastDone();
  assert.deepEqual(result.errors, []);
  const hot = hotFiles(result);
  assert.ok(
    hot.some((n) => n.endsWith('.hot-update.json')),
    `manifest: ${hot}`,
  );
  assert.ok(hot.some((n) => n.endsWith('.hot-update.js')), `chunk: ${hot}`);
  assert.ok(
    text(result, (n) => n.endsWith('.hot-update.js')).includes('Hello again'),
  );
  serve(result);
  tsxResult = result;
  return `${result.durationMs} ms in Rspack; emitted ${
    result.emitted.map((a) => a.name).join(', ')
  }`;
});

await step('TSX hot update is applied in the dev card', async () => {
  assert.ok(tsxResult, 'the TSX rebuild succeeded');
  await hotUpdate(tsxResult.hash, titleIs, {
    text: 'Hello again',
    color: 'rgb(0, 0, 255)',
  });
  return `text changed after hash ${tsxResult.hash}, no reload`;
});

await step(
  'syntax error reports file/line, next good edit recovers',
  async () => {
    let before = await countEvents();
    await kit('applyChanges', [{
      type: 'write',
      path: 'src/main/App.tsx',
      content: 'export function App() {\n  return <view>\n}\n',
    }]);
    await waitForDone(before.done + 1);
    assert.deepEqual(await countEvents(), {
      start: before.start + 1,
      done: before.done + 1,
    });
    const failed = await lastDone();
    assert.ok(failed.errors.length > 0);
    assert.deepEqual(failed.cards, []);
    const located = failed.errors.find((e) =>
      e.file === 'src/main/App.tsx' && typeof e.line === 'number'
    );
    assert.ok(
      located,
      JSON.stringify(
        failed.errors.map(({ file, line, column, message }) => ({
          file,
          line,
          column,
          message: message.slice(0, 300),
        })),
        null,
        2,
      ),
    );

    before = await countEvents();
    await kit('applyChanges', [{
      type: 'write',
      path: 'src/main/App.tsx',
      content: fixtureFiles['src/main/App.tsx'].replace(
        'Hello from the web bundle kit',
        'Recovered',
      ),
    }]);
    await waitForDone(before.done + 1);
    assert.deepEqual(await countEvents(), {
      start: before.start + 1,
      done: before.done + 1,
    });
    const recovered = await lastDone();
    assert.deepEqual(recovered.errors, []);
    assert.equal(recovered.cards.length, 2);
    serve(recovered);
    return `error: ${located.file}:${located.line}:${located.column}${
      process.env.KIT_E2E_VERBOSE ? `\n${located.message}` : ''
    }`;
  },
);

await step('project node_modules wins over the kit\'s mirror', async () => {
  const before = await countEvents();
  await kit('applyChanges', [
    {
      type: 'write',
      path: 'node_modules/tiny-invariant/package.json',
      content: JSON.stringify({
        name: 'tiny-invariant',
        version: '9.9.9',
        main: 'index.js',
      }),
    },
    {
      type: 'write',
      path: 'node_modules/tiny-invariant/index.js',
      content:
        'module.exports = function invariant() { return "from the project node_modules"; };\n',
    },
    {
      type: 'write',
      path: 'src/main/App.tsx',
      content: `import invariant from 'tiny-invariant';\n${
        fixtureFiles['src/main/App.tsx'].replace(
          '\'Hello from the web bundle kit\'',
          'invariant()',
        ).replace('Hello from the web bundle kit', '{invariant()}')
      }`,
    },
  ]);
  await waitForDone(before.done + 1);
  assert.deepEqual(await countEvents(), {
    start: before.start + 1,
    done: before.done + 1,
  });
  const result = await lastDone();
  assert.deepEqual(result.errors, [], JSON.stringify(result.errors, null, 2));
  assert.ok(
    text(result, (n) => n.endsWith('.js') || n.endsWith('.bundle')).includes(
      'from the project node_modules',
    ),
  );
  const listed = await kit('listFiles');
  assert.ok(listed.includes('node_modules/tiny-invariant/index.js'));
  return 'the hot update contains the project copy of tiny-invariant';
});

await step('close()', async () => {
  await kit('close');
});

console.log(`timings (ms): ${JSON.stringify(timings)}`);
const failures = results.filter((r) => !r.ok);
if (failures.length > 0 || process.env.KIT_E2E_VERBOSE) {
  console.log('--- browser console (last 60 lines) ---');
  console.log(consoleLines.slice(-60).join('\n'));
}
await browser.close();
console.log(`${results.length - failures.length}/${results.length} passed`);
process.exitCode = failures.length > 0 ? 1 : 0;
