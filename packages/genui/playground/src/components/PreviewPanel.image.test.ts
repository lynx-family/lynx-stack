// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */
/* eslint-disable n/no-unsupported-features/node-builtins -- Tests inspect browser FormData requests in jsdom. */
import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { PreviewPanel } from './PreviewPanel.js';
import type { PreviewPanelSource } from './PreviewPanel.js';
import { PreviewViewport } from './PreviewViewport.js';

rstest.mock('./QrCode.js', () => ({ QrCode: () => null }));

const NATIVE_URL = 'https://cdn.example.com/main.lynx.js';
const WEB_URL = 'https://cdn.example.com/main.web.js';
const IMAGE_URL = 'https://cdn.example.com/screenshot.bmp';
const REACT_LYNX_SOURCE: PreviewPanelSource = {
  kind: 'reactlynx',
  nativeUrl: NATIVE_URL,
  webUrl: WEB_URL,
};

let container: HTMLDivElement;
let root: Root;
let requests: { url: string; init: RequestInit }[];

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/#/reactlynx/create');
  rstest.stubGlobal('React', React);
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  requests = [];
  rstest.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    if (url === '/__rspeedy_url') return Promise.resolve({ ok: false });
    requests.push({ url, init });
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ url: IMAGE_URL }),
    });
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await React.act(async () => root.unmount());
  container.remove();
  rstest.restoreAllMocks();
  rstest.unstubAllGlobals();
  window.localStorage.clear();
});

function button(text: string) {
  const element = [...container.querySelectorAll('button')].find(item =>
    item.textContent?.trim() === text
  );
  if (!element) throw new Error(`Missing ${text} button`);
  return element;
}

function input(label: string) {
  const element = [...container.querySelectorAll('label')].find(item =>
    item.textContent?.trim() === label
  )?.querySelector('input');
  if (!element) throw new Error(`Missing ${label} input`);
  return element;
}

async function changeInput(label: string, value: string) {
  await React.act(async () => {
    const element = input(label);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!
      .set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
  });
}

async function mount(source: PreviewPanelSource = REACT_LYNX_SOURCE) {
  await React.act(async () =>
    root.render(React.createElement(PreviewPanel, {
      key: source.kind,
      title: 'Lynx preview',
      previewSource: source,
      showPreviewModeSwitch: true,
      showSimulationBar: false,
      // biome-ignore lint/correctness/noChildrenProp: PreviewPanel requires children in createElement's typed props.
      children: React.createElement(PreviewViewport, {
        emptyTitle: 'Waiting for preview',
      }),
    }))
  );
  const screen = container.querySelector('.phoneScreen')!;
  Object.defineProperties(screen, {
    clientWidth: { configurable: true, value: 412 },
    clientHeight: { configurable: true, value: 738 },
  });
  await React.act(async () => window.dispatchEvent(new Event('resize')));
}

test('captures the native bundle with the current phone size and defaults while preserving the live preview', async () => {
  await mount();
  const modes = container.querySelector('[aria-label="Preview mode"]')!;
  expect([...modes.querySelectorAll('button')].map(item => item.textContent))
    .toEqual(['Phone', 'Full', 'Image']);
  expect(button('Phone').getAttribute('aria-pressed')).toBe('true');
  expect(button('Full').getAttribute('aria-pressed')).toBe('false');
  expect(button('Image').getAttribute('aria-pressed')).toBe('false');

  const frame = container.querySelector('iframe')!;
  const frameUrl = frame.src;
  expect(new URL(frameUrl).searchParams.get('bundleUrl')).toBe(WEB_URL);
  await React.act(async () => button('Image').click());
  expect(button('Phone').getAttribute('aria-pressed')).toBe('false');
  expect(button('Image').getAttribute('aria-pressed')).toBe('true');
  expect(container.querySelector('iframe')).toBe(frame);
  expect(frame.src).toBe(frameUrl);
  expect(frame.closest('[hidden]')).not.toBeNull();
  expect(requests).toHaveLength(0);

  await React.act(async () => button('Settings').click());
  expect(input('UI Judge endpoint').value).toBe(
    'https://server-render.lynx-stack.dev/',
  );
  expect(input('Width (px)').value).toBe('412');
  expect(input('Height (px)').value).toBe('738');
  expect(input('Screenshot delay (ms)').value).toBe('2000');
  expect(input('Timeout (ms)').value).toBe('30000');
  expect(container.querySelectorAll('input[type="url"]')).toHaveLength(1);
  expect(
    [...container.querySelectorAll('label')].some(label =>
      /template/i.test(label.textContent ?? '')
    ),
  ).toBe(false);

  await React.act(async () => button('Capture').click());
  expect(requests).toHaveLength(1);
  expect(requests[0]!.url).toBe(
    'https://server-render.lynx-stack.dev/screenshot/template',
  );
  expect(requests[0]!.init.method).toBe('POST');
  const form = requests[0]!.init.body as FormData;
  expect(form.get('url')).toBe(NATIVE_URL);
  expect(form.get('url')).not.toBe(WEB_URL);
  expect(form.get('width')).toBe('412');
  expect(form.get('height')).toBe('738');
  expect(form.get('screenshotSettleMs')).toBe('2000');

  const image = container.querySelector<HTMLImageElement>(
    'img[alt^="Native Lynx screenshot"]',
  )!;
  expect(image.src).toBe(IMAGE_URL);
  await React.act(async () => image.dispatchEvent(new Event('load')));
  await React.act(async () => button('Phone').click());
  expect(container.querySelector('iframe')).toBe(frame);
  expect(frame.closest('[hidden]')).toBeNull();
  expect(image.closest('[hidden]')).not.toBeNull();
  await React.act(async () => button('Image').click());
  expect(container.querySelector('iframe')).toBe(frame);
  expect(frame.src).toBe(frameUrl);
  expect(container.querySelector('img')).toBe(image);
  expect(image.closest('[hidden]')).toBeNull();
  expect(button('Recapture').disabled).toBe(false);
  expect(requests).toHaveLength(1);
});

test('preserves custom capture settings and image across mode changes and can restore phone dimensions', async () => {
  await mount();
  await React.act(async () => button('Image').click());
  await React.act(async () => button('Settings').click());
  await changeInput('UI Judge endpoint', 'https://capture.example.com/native/');
  await changeInput('Width (px)', '390');
  await changeInput('Height (px)', '844');
  await changeInput('Screenshot delay (ms)', '0');
  await changeInput('Timeout (ms)', '45000');
  await React.act(async () => button('Capture').click());
  expect(requests[0]!.url).toBe(
    'https://capture.example.com/native/screenshot/template',
  );
  const form = requests[0]!.init.body as FormData;
  expect(form.get('width')).toBe('390');
  expect(form.get('height')).toBe('844');
  expect(form.get('screenshotSettleMs')).toBe('0');
  expect(form.get('timeoutMs')).toBe('45000');
  expect(form.get('url')).toBe(NATIVE_URL);

  const image = container.querySelector('img');
  await React.act(async () => button('Full').click());
  expect(button('Full').getAttribute('aria-pressed')).toBe('true');
  await React.act(async () => button('Image').click());
  expect(container.querySelector('img')).toBe(image);
  expect(input('UI Judge endpoint').value).toBe(
    'https://capture.example.com/native/',
  );
  expect(input('Width (px)').value).toBe('390');
  expect(input('Height (px)').value).toBe('844');
  expect(input('Screenshot delay (ms)').value).toBe('0');
  expect(input('Timeout (ms)').value).toBe('45000');
  expect(requests).toHaveLength(1);

  await React.act(async () => button('Use phone size').click());
  expect(input('Width (px)').value).toBe('412');
  expect(input('Height (px)').value).toBe('738');
});

test('remeasures the phone screen when a new preview replaces the viewport', async () => {
  await mount();
  const previousFrame = container.querySelector('iframe');
  await React.act(async () =>
    root.render(React.createElement(PreviewPanel, {
      key: REACT_LYNX_SOURCE.kind,
      title: 'Lynx preview',
      previewSource: REACT_LYNX_SOURCE,
      showPreviewModeSwitch: true,
      showSimulationBar: false,
      // biome-ignore lint/correctness/noChildrenProp: PreviewPanel requires children in createElement's typed props.
      children: React.createElement(PreviewViewport, {
        key: 'new-preview',
        emptyTitle: 'Waiting for preview',
        iframeRef: (frame) => {
          if (!frame) return;
          Object.defineProperties(frame.closest('.phoneScreen')!, {
            clientWidth: { configurable: true, value: 428 },
            clientHeight: { configurable: true, value: 780 },
          });
        },
      }),
    }))
  );
  expect(container.querySelector('iframe')).not.toBe(previousFrame);
  await React.act(async () => button('Image').click());
  await React.act(async () => button('Settings').click());
  expect(input('Width (px)').value).toBe('428');
  expect(input('Height (px)').value).toBe('780');
});

test('keeps Image unavailable for HTML and ReactWeb previews', async () => {
  const sources: PreviewPanelSource[] = [
    {
      kind: 'html',
      source: '<!doctype html><html><body>Preview</body></html>',
    },
    { kind: 'reactweb', webUrl: 'https://cdn.example.com/index.html' },
  ];
  for (const source of sources) {
    await mount(source);
    const modes = container.querySelector('[aria-label="Preview mode"]')!;
    expect([...modes.querySelectorAll('button')].map(item => item.textContent))
      .toEqual(['Phone', 'Full']);
    expect(container.querySelector('[aria-label="Native screenshot"]'))
      .toBeNull();
  }
  expect(requests).toHaveLength(0);
});
