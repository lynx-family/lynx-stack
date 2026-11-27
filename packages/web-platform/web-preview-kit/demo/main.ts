// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * A host application that embeds the kit from another origin and drives it
 * through the client of `src/client`. It is the manual test bed and the
 * fixture of the end-to-end test of `src/client`, which uses `window.demo`.
 *
 * Query parameters:
 * - `kit`: the URL of the kit page. Defaults to port 4210 of this host.
 * - `dip=0`: asks the kit server not to send `Document-Isolation-Policy`.
 * - `open=0`: does not open the sample project.
 */

import { connectPreview } from '../src/client/index.js';
import type {
  EventName,
  Events,
  FileMap,
  PreviewClient,
} from '../src/client/index.js';
import { sampleConfig, sampleFiles } from './sample.js';

const query = new URLSearchParams(location.search);
const kitUrl = new URL(
  query.get('kit')
    ?? `${location.protocol}//${location.hostname}:4210/index.html`,
);
if (query.get('dip') === '0') {
  kitUrl.searchParams.set('dip', '0');
}

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const iframe = $<HTMLIFrameElement>('preview');
const fileList = $<HTMLUListElement>('files');
const editor = $<HTMLTextAreaElement>('editor');
const cardSelect = $<HTMLSelectElement>('card');
const status = $<HTMLSpanElement>('status');
const diagnostics = $<HTMLPreElement>('diagnostics');
const log = $<HTMLPreElement>('log');

/** Every event the kit sent, for the tests. */
const events: { event: EventName; data: unknown }[] = [];

const files: FileMap = { ...sampleFiles };
let currentPath = Object.keys(files)[0]!;
let client: PreviewClient | undefined;

function appendLog(line: string): void {
  log.textContent = `${line}\n${log.textContent ?? ''}`.slice(0, 20_000);
}

function renderFiles(): void {
  fileList.replaceChildren(
    ...Object.keys(files).sort().map((path) => {
      const item = document.createElement('li');
      item.textContent = path;
      item.className = path === currentPath ? 'active' : '';
      item.addEventListener('click', () => {
        currentPath = path;
        editor.value = String(files[path]);
        renderFiles();
      });
      return item;
    }),
  );
}

function renderCards(names: string[], selected?: string): void {
  cardSelect.replaceChildren(
    ...names.map((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      option.selected = name === selected;
      return option;
    }),
  );
}

async function applyEdit(): Promise<void> {
  files[currentPath] = editor.value;
  const { revision } = await client!.writeFile(currentPath, editor.value);
  appendLog(`revision ${revision}: wrote ${currentPath}`);
}

let typingTimer: ReturnType<typeof setTimeout> | undefined;
editor.addEventListener('input', () => {
  if (!$<HTMLInputElement>('auto-apply').checked) {
    return;
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => void applyEdit(), 300);
});
$('apply').addEventListener('click', () => void applyEdit());
$('reload').addEventListener('click', () => void client?.reload());
cardSelect.addEventListener('change', () => {
  void client?.selectCard(cardSelect.value);
});

function listen(preview: PreviewClient): void {
  const names: EventName[] = [
    'build.start',
    'build.done',
    'preview.load',
    'preview.hmr',
    'preview.error',
  ];
  for (const name of names) {
    preview.on(name, (data: Events[typeof name]) => {
      events.push({ event: name, data });
      appendLog(`${name} ${JSON.stringify(data, summarize)}`);
    });
  }
  preview.on('build.start', ({ buildId, revision }) => {
    status.className = '';
    status.textContent = `building #${buildId} (revision ${revision})…`;
  });
  preview.on('build.done', (summary) => {
    status.className = summary.success ? '' : 'failed';
    status.textContent = `build #${summary.buildId} ${
      summary.success ? 'succeeded' : 'failed'
    } in ${Math.round(summary.durationMs)} ms`;
    diagnostics.textContent = [...summary.errors, ...summary.warnings]
      .map(item =>
        `${item.file ?? ''}${item.line ? `:${item.line}` : ''}\n${item.message}`
      )
      .join('\n\n');
  });
}

/** Keeps the event log short: bytes and long lists are summarized. */
function summarize(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return `<${value.byteLength} bytes>`;
  }
  if (Array.isArray(value) && value.length > 8) {
    return `<${value.length} items>`;
  }
  return value;
}

const ready = (async () => {
  iframe.src = kitUrl.href;
  const preview = await connectPreview(iframe, { origin: kitUrl.origin });
  client = preview;
  listen(preview);
  appendLog(`hello ${JSON.stringify(preview.hello)}`);
  if (!preview.hello.supported) {
    status.className = 'failed';
    status.textContent = `unsupported: ${preview.hello.reason}`;
    return preview;
  }
  status.textContent = 'connected';
  renderFiles();
  editor.value = String(files[currentPath]);
  renderCards(Object.keys(sampleConfig.entries), 'main');
  if (query.get('open') !== '0') {
    await preview.open(files, sampleConfig);
  }
  return preview;
})();
ready.catch((error: unknown) => {
  status.className = 'failed';
  status.textContent = String(error);
});

declare global {
  interface Window {
    demo: {
      ready: Promise<PreviewClient>;
      events: typeof events;
      sampleFiles: FileMap;
      sampleConfig: typeof sampleConfig;
      /** `connectPreview` of the client, for other iframes. */
      connectPreview: typeof connectPreview;
    };
  }
}
window.demo = { ready, events, sampleFiles, sampleConfig, connectPreview };
