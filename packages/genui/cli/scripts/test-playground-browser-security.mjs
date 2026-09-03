#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import { createServer } from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';

import { chromium } from '@playwright/test';

import { startPlaygroundHttp } from '../dist/playground/server.js';
import { PlaygroundStore } from '../dist/playground/store.js';

const root = fs.mkdtempSync(
  path.join(fs.realpathSync(os.tmpdir()), 'genui-browser-security-'),
);
const attackerHits = [];
const attacker = createServer((request, response) => {
  attackerHits.push(request.url ?? '/');
  response.writeHead(204).end();
});
attacker.on('upgrade', (request, socket) => {
  attackerHits.push(request.url ?? '/');
  socket.destroy();
});
await listen(attacker, 0, '127.0.0.1');
const attackerAddress = attacker.address();
assert(attackerAddress && typeof attackerAddress === 'object');
const attackerOrigin = 'http://127.0.0.1:' + attackerAddress.port;
const attackerWs = 'ws://127.0.0.1:' + attackerAddress.port;

const port = await availablePort();
const conversationId = randomUUID();
const sessionId = randomUUID();
const firstTurnId = randomUUID();
const secondTurnId = randomUUID();
let http;
let browser;
let agentReads = 0;
let controlApiHits = 0;
const previewRequests = [];
const previewCookies = [];
const browserDiagnostics = [];
const store = new PlaygroundStore(path.join(root, 'data'), {
  onEvent: (id, event) => http?.publish(id, event),
});
const malicious = maliciousArtifact(attackerOrigin, attackerWs, port);

try {
  seedArtifact(store, conversationId, sessionId, firstTurnId, malicious);
  http = await startPlaygroundHttp({
    port,
    assetsRoot: path.resolve('dist/playground/public'),
    store,
    engine: {
      descriptors() {
        agentReads += 1;
        return [];
      },
    },
  });
  assert.equal(http.previewIsolation.status, 'isolated');
  assert.equal(http.previewIsolation.isolationCompliant, true);
  assert.equal(http.previewIsolation.distinctPort, true);
  let mutationApiHits = 0;
  let appServiceRequests = 0;
  http.controlServer.on('request', (request) => {
    if (
      request.method === 'POST'
      && request.url === '/api/data-directory/open'
    ) mutationApiHits += 1;
  });
  http.previewServer.on('request', (request) => {
    const pathname = new URL(request.url ?? '/', http.previewOrigin).pathname;
    if (pathname === '/app-service.js') appServiceRequests += 1;
  });
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ?? (process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined);
  browser = await chromium.launch({
    headless: true,
    args: ['--no-proxy-server'],
    ...(executablePath && fs.existsSync(executablePath)
      ? { executablePath }
      : {}),
  });
  const context = await browser.newContext({ acceptDownloads: false });
  const page = await context.newPage();
  await context.addCookies([{
    name: 'genui_session',
    value: 'preview-cookie-must-not-see-this',
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Strict',
  }]);
  let popups = 0;
  let downloads = 0;
  page.on('popup', () => popups += 1);
  page.on('download', () => downloads += 1);
  page.on('request', (request) => {
    if (request.url().startsWith(http.controlOrigin + '/api/agents')) {
      controlApiHits += 1;
    }
    if (request.url().startsWith(http.previewOrigin + '/probe/')) {
      previewRequests.push(new URL(request.url()).pathname);
      previewCookies.push(request.headers()['cookie']);
    }
  });
  page.on('console', (message) => {
    browserDiagnostics.push(
      'console ' + message.type() + ': ' + message.text(),
    );
  });
  page.on('pageerror', (error) => {
    browserDiagnostics.push('pageerror: ' + error.message);
  });
  page.on('requestfailed', (request) => {
    browserDiagnostics.push(
      'requestfailed: ' + request.url() + ' ' + request.failure()?.errorText,
    );
  });
  await page.goto(http.issueBootstrapUrl());
  await page.waitForSelector('iframe');
  const firstFrame = await page.locator('iframe').elementHandle();
  assert(firstFrame);
  const firstFrameUrl = new URL(
    await firstFrame.getAttribute('src'),
    http.controlOrigin,
  );
  await waitFor(() => previewRequests.includes('/probe/self-ok'), 15_000);
  await waitFor(() => previewRequests.includes('/probe/blob-ok'), 15_000);
  await waitFor(
    () => previewRequests.includes('/probe/parent-blocked'),
    15_000,
  );
  await waitFor(() => previewRequests.includes('/probe/cookie-empty'), 15_000);
  for (
    const probe of [
      'control-api-blocked',
      'csrf-api-blocked',
      'external-fetch-blocked',
      'websocket-blocked',
      'image-blocked',
      'font-blocked',
      'form-attempted',
      'top-navigation-blocked',
      'popup-blocked',
      'download-attempted',
      'object-attempted',
    ]
  ) {
    await waitFor(() => previewRequests.includes('/probe/' + probe), 15_000);
  }
  await page.waitForTimeout(500);

  const firstPreview = await firstFrame.contentFrame();
  assert(firstPreview);
  assert.equal(
    await firstPreview.locator('.localAgentPreviewFatal').count(),
    0,
    'main-only malicious artifact entered the fatal preview state',
  );

  assert.equal(agentReads, 1, 'malicious XML reached the control API');
  assert.equal(controlApiHits, 1, 'malicious XML sent a control API request');
  assert.equal(mutationApiHits, 0, 'malicious XML sent a CSRF-protected write');
  assert.equal(
    previewRequests.includes('/probe/cookie-present'),
    false,
    'preview received the host-only control cookie',
  );
  assert.equal(
    previewCookies.every((cookie) => cookie === undefined),
    true,
    'preview requests carried a control-origin cookie',
  );
  assert.deepEqual(
    attackerHits,
    [],
    'an external HTTP or WebSocket escaped CSP',
  );
  assert.equal(popups, 0, 'sandbox allowed a popup');
  assert.equal(downloads, 0, 'sandbox allowed a download');
  assert.equal(page.url().startsWith(http.controlOrigin), true);

  seedArtifact(store, conversationId, sessionId, secondTurnId, safeArtifact());
  const secondTurn = store.getTurn(conversationId, secondTurnId);
  store.emit(conversationId, 'turn.completed', {
    turn: secondTurn,
    revision: secondTurn.revision,
  }, secondTurnId);
  const secondFrameLocator = page.locator('iframe[src*="revision=2"]');
  await secondFrameLocator.waitFor();
  const secondFrameHandle = await secondFrameLocator.elementHandle();
  assert(secondFrameHandle);
  const secondPreview = await secondFrameHandle.contentFrame();
  assert(secondPreview);
  await secondPreview.getByText('Main-only preview ready', { exact: true })
    .waitFor();
  const previewSurface = await secondPreview.evaluate(() => {
    const lynxView = globalThis.document.querySelector(
      'lynx-view.isolated-lynx-view',
    );
    if (!lynxView) return null;
    const htmlRect = globalThis.document.documentElement
      .getBoundingClientRect();
    const bodyRect = globalThis.document.body.getBoundingClientRect();
    const lynxViewRect = lynxView.getBoundingClientRect();
    return {
      viewport: {
        width: globalThis.innerWidth,
        height: globalThis.innerHeight,
      },
      html: {
        x: htmlRect.x,
        y: htmlRect.y,
        width: htmlRect.width,
        height: htmlRect.height,
      },
      body: {
        x: bodyRect.x,
        y: bodyRect.y,
        width: bodyRect.width,
        height: bodyRect.height,
      },
      lynxView: {
        x: lynxViewRect.x,
        y: lynxViewRect.y,
        width: lynxViewRect.width,
        height: lynxViewRect.height,
      },
    };
  });
  assert(previewSurface, 'isolated preview did not mount a LynxView');
  assert(
    previewSurface.viewport.width > 0 && previewSurface.viewport.height > 0,
    'isolated preview viewport has no drawable area',
  );
  for (
    const [name, bounds] of Object.entries({
      html: previewSurface.html,
      body: previewSurface.body,
      lynxView: previewSurface.lynxView,
    })
  ) {
    assert(
      bounds.width > 0 && bounds.height > 0,
      `${name} has no drawable area: ${JSON.stringify(bounds)}`,
    );
    assert(
      Math.abs(bounds.width - previewSurface.viewport.width) <= 0.5
        && Math.abs(bounds.height - previewSurface.viewport.height) <= 0.5,
      `${name} does not fill the preview viewport: ${
        JSON.stringify({
          bounds,
          viewport: previewSurface.viewport,
        })
      }`,
    );
  }
  const businessSurface = await secondPreview.locator('.screen')
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        bounds: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        backgroundColor: globalThis.getComputedStyle(element).backgroundColor,
      };
    });
  assert(
    businessSurface.bounds.width > 0 && businessSurface.bounds.height > 0,
    'Lynx business surface has no drawable area',
  );
  assert.equal(
    businessSurface.backgroundColor,
    'rgb(18, 103, 214)',
    'visible fixture background was not rendered',
  );
  assert(
    businessSurface.bounds.x >= previewSurface.lynxView.x - 0.5
      && businessSurface.bounds.y >= previewSurface.lynxView.y - 0.5
      && businessSurface.bounds.x + businessSurface.bounds.width
        <= previewSurface.lynxView.x + previewSurface.lynxView.width + 0.5
      && businessSurface.bounds.y + businessSurface.bounds.height
        <= previewSurface.lynxView.y + previewSurface.lynxView.height + 0.5,
    `Lynx business surface escaped the drawable host: ${
      JSON.stringify({
        business: businessSurface.bounds,
        host: previewSurface.lynxView,
      })
    }`,
  );
  assert.equal(
    await secondPreview.locator('.localAgentPreviewFatal').count(),
    0,
    'main-only safe artifact entered the fatal preview state',
  );
  assert.equal(
    appServiceRequests,
    0,
    'main-only artifacts fell back to an HTTP app-service.js request',
  );
  assert.equal(
    browserDiagnostics.some((entry) => entry.includes('loadCard failed')),
    false,
    'main-only artifacts failed during Lynx Core background bootstrap',
  );
  const selfProbesBeforeStaleMessage = previewRequests.filter((request) =>
    request === '/probe/self-ok'
  ).length;
  await page.evaluate(
    ({
      oldConversationId,
      oldHash,
      oldNonce,
      oldRevision,
      oldSource,
      previewOrigin,
    }) => {
      const frame = globalThis.document.querySelector('iframe');
      frame?.contentWindow?.postMessage({
        type: 'genui-preview-artifact',
        nonce: oldNonce + '-stale',
        conversationId: oldConversationId,
        revision: oldRevision,
        hash: oldHash,
        source: oldSource,
      }, previewOrigin);
    },
    {
      oldConversationId: conversationId,
      oldHash: store.artifactHash(conversationId, '1'),
      oldNonce: firstFrameUrl.searchParams.get('nonce'),
      oldRevision: '1',
      oldSource: malicious,
      previewOrigin: http.previewOrigin,
    },
  );
  await page.waitForTimeout(250);
  assert.equal(
    previewRequests.filter((request) => request === '/probe/self-ok').length,
    selfProbesBeforeStaleMessage,
    'new browsing context accepted an old revision capability',
  );
  assert.equal(
    await firstFrame.evaluate((node) =>
      node /** @type {HTMLElement} */.isConnected
    ),
    false,
    'old revision iframe remained live',
  );

  const conversationsBeforeExamples = await conversationCount(page);
  await page.evaluate(() => {
    globalThis.location.hash = '#/lynx-xml/examples';
  });
  await page.waitForSelector('.exampleCard');
  await page.waitForFunction(() =>
    globalThis.document.querySelectorAll('.exampleCard iframe').length === 5
  );
  const cardFrames = page.locator('.exampleCard iframe');
  assert.equal(await cardFrames.count(), 5);
  await assertIsolatedFrames(cardFrames, http.previewOrigin);

  await page.evaluate(() => {
    globalThis.location.hash = '#/lynx-xml/examples/counter';
  });
  await page.waitForSelector('.examplesPreviewPanel iframe');
  const initialExampleFrame = await page.locator(
    '.examplesPreviewPanel iframe',
  ).elementHandle();
  assert(initialExampleFrame);
  const initialExampleSrc = await initialExampleFrame.getAttribute('src');
  assert(initialExampleSrc);
  await assertIsolatedFrames(
    page.locator('.examplesPreviewPanel iframe'),
    http.previewOrigin,
  );

  const editedSource = safeArtifact().replace(
    'const page =',
    'const marker = "edited"; const page =',
  );
  await page.locator('.cm-content').fill(editedSource);
  await page.locator('.toolbarActions button', { hasText: 'Render' }).click();
  await page.waitForFunction((previous) => {
    const frame = globalThis.document.querySelector(
      '.examplesPreviewPanel iframe',
    );
    return frame instanceof globalThis.HTMLIFrameElement
      && frame.src !== previous;
  }, initialExampleSrc);
  await assertIsolatedFrames(
    page.locator('.examplesPreviewPanel iframe'),
    http.previewOrigin,
  );
  assert.equal(
    await initialExampleFrame.evaluate((node) =>
      node /** @type {HTMLElement} */.isConnected
    ),
    false,
    'edited example reused its previous browsing context',
  );
  assert.equal(
    await conversationCount(page),
    conversationsBeforeExamples,
    'Examples created a Daemon conversation',
  );
  assert.equal(agentReads, 1, 'Examples called the Agent API');

  console.info(JSON.stringify(
    {
      browser: 'chromium',
      previewIsolation: http.previewIsolation,
      verified: [
        'parent-dom',
        'cookie-host-boundary',
        'control-api',
        'external-fetch',
        'websocket',
        'image',
        'font',
        'form',
        'top-navigation',
        'popup',
        'download',
        'object',
        'old-revision-capability',
        'example-card-isolation',
        'example-editor-isolation',
        'examples-no-agent-call',
        'main-only-artifact-render',
        'non-zero-preview-surface',
        'empty-app-service-chunk',
        'connect-src-self',
        'connect-src-blob',
      ],
    },
    null,
    2,
  ));
} finally {
  await browser?.close();
  await http?.close();
  await new Promise((resolve) => attacker.close(resolve));
  fs.rmSync(root, { recursive: true, force: true });
}

function seedArtifact(store, conversationId, sessionId, turnId, artifact) {
  if (!store.conversations.has(conversationId)) {
    store.putConversation(conversationId, { title: 'Security suite' });
    store.putSession(conversationId, sessionId, { agentId: 'codex' });
  }
  store.acceptTurn(conversationId, turnId, {
    sessionId,
    agentId: 'codex',
    prompt: 'security test',
  });
  store.updateTurn(conversationId, turnId, { status: 'running' });
  const revision = store.commitArtifact(conversationId, turnId, artifact);
  store.updateTurn(conversationId, turnId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    revision,
  });
}

function maliciousArtifact(attackerOrigin, attackerWs, controlPort) {
  return `<!doctype lynx>
<lynx engine-version="4.2">
<script thread="main">
const report = (name) => fetch('/probe/' + name).catch(() => {});
fetch('/probe/self-ok').catch(() => {});
fetch(new Blob(['ok']).text ? URL.createObjectURL(new Blob(['ok'])) : '')
  .then(() => report('blob-ok')).catch(() => report('blob-blocked'));
try { globalThis.parent.parent.document.body; report('parent-open'); }
catch { report('parent-blocked'); }
report(document.cookie ? 'cookie-present' : 'cookie-empty');
fetch('http://127.0.0.1:${controlPort}/api/agents', { credentials: 'include' })
  .then(() => report('control-api-open'))
  .catch(() => report('control-api-blocked'));
fetch('http://127.0.0.1:${controlPort}/api/data-directory/open', {
  method: 'POST', credentials: 'include', headers: { 'x-genui-csrf': 'stolen' }
}).then(() => report('csrf-api-open')).catch(() => report('csrf-api-blocked'));
fetch('${attackerOrigin}/fetch')
  .then(() => report('external-fetch-open'))
  .catch(() => report('external-fetch-blocked'));
try {
  const socket = new WebSocket('${attackerWs}/socket');
  socket.onopen = () => report('websocket-open');
  socket.onerror = () => report('websocket-blocked');
} catch { report('websocket-blocked'); }
const image = document.createElement('img'); image.src = '${attackerOrigin}/image';
image.onload = () => report('image-open');
image.onerror = () => report('image-blocked');
document.body.appendChild(image);
const style = document.createElement('style');
style.textContent = '@font-face{font-family:x;src:url(' +
  String.fromCharCode(34) + '${attackerOrigin}/font' +
  String.fromCharCode(34) + ')}body{font-family:x}';
document.head.appendChild(style);
document.body.append('font probe');
document.fonts.load('12px x')
  .then((fonts) => report(fonts.length ? 'font-open' : 'font-blocked'))
  .catch(() => report('font-blocked'));
const form = document.createElement('form'); form.action = '${attackerOrigin}/form';
document.body.appendChild(form);
try { form.submit(); report('form-attempted'); } catch { report('form-attempted'); }
try { globalThis.top.location.href = '${attackerOrigin}/top'; }
catch { report('top-navigation-blocked'); }
try {
  report(globalThis.open('${attackerOrigin}/popup') ? 'popup-open' : 'popup-blocked');
} catch { report('popup-blocked'); }
const link = document.createElement('a'); link.href = '${attackerOrigin}/download';
link.download = 'stolen'; document.body.appendChild(link); link.click();
report('download-attempted');
const object = document.createElement('object'); object.data = '${attackerOrigin}/object';
document.body.appendChild(object);
report('object-attempted');
const page = __CreatePage('0', 0);
</script>
</lynx>`;
}

function safeArtifact() {
  return `<!doctype lynx>
<lynx engine-version="4.2">
<style>
.main-only-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  align-items: center;
  justify-content: center;
  background-color: #1267d6;
}
.main-only-label {
  color: #ffffff;
  font-size: 1.5rem;
}
</style>
<script thread="main">
const engine = lynx.getEngine();
let rendered = false;
engine.addEventListener('__RenderPage', () => {
  if (rendered) return;
  rendered = true;
  const page = __CreatePage('0', 0);
  const pageId = __GetElementUniqueID(page);
  __SetClasses(page, 'main-only-page screen');
  const text = __CreateText(pageId);
  __SetClasses(text, 'main-only-label');
  const raw = __CreateRawText('Main-only preview ready');
  __AppendElement(text, raw);
  __AppendElement(page, text);
});
</script>
</lynx>`;
}

async function availablePort() {
  const server = createServer();
  await listen(server, 0, '127.0.0.1');
  const address = server.address();
  assert(address && typeof address === 'object');
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function listen(server, port, host) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(
        'Timed out waiting for browser probe: ' + JSON.stringify({
          previewRequests,
          browserDiagnostics,
        }),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function conversationCount(page) {
  return await page.evaluate(async () => {
    const response = await globalThis.fetch('/api/conversations', {
      credentials: 'same-origin',
    });
    const body = await response.json();
    return body.conversations.length;
  });
}

async function assertIsolatedFrames(locator, previewOrigin) {
  const frames = await locator.evaluateAll((items) =>
    items.map((item) => ({
      src: item.getAttribute('src'),
      sandbox: item.getAttribute('sandbox'),
      referrerPolicy: item.getAttribute('referrerpolicy'),
    }))
  );
  assert(frames.length > 0);
  for (const frame of frames) {
    assert(frame.src);
    assert.equal(new URL(frame.src).origin, previewOrigin);
    assert.equal(frame.sandbox, 'allow-scripts allow-same-origin');
    assert.equal(frame.referrerPolicy, 'no-referrer');
  }
}
