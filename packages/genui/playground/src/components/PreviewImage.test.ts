// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { PreviewImage } from './PreviewImage.js';
import type { PreviewImageSettings } from './PreviewImage.js';

describe('native image preview', () => {
  let container: HTMLDivElement;
  let root: Root;
  let props: React.ComponentProps<typeof PreviewImage>;
  let captures: {
    settings: PreviewImageSettings;
    signal: AbortSignal;
    resolve: (url: string) => void;
    reject: (error: Error) => void;
  }[];

  beforeEach(() => {
    rstest.stubGlobal('React', React);
    rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    captures = [];
    props = {
      sourceKey: 'initial-preview',
      phoneSize: { width: 390, height: 700 },
      capture: (settings, signal) =>
        new Promise((resolve, reject) => {
          captures.push({ settings, signal, resolve, reject });
        }),
    };
  });

  afterEach(async () => {
    await React.act(async () => root.unmount());
    container.remove();
    rstest.unstubAllGlobals();
  });

  async function render(overrides: Partial<typeof props> = {}) {
    props = { ...props, ...overrides };
    await React.act(async () =>
      root.render(React.createElement(PreviewImage, props))
    );
  }

  function button(label: string): HTMLButtonElement {
    const match = Array.from(container.querySelectorAll('button'))
      .find((element) => element.textContent === label);
    if (!match) throw new Error(`Missing button: ${label}`);
    return match;
  }

  async function click(label: string) {
    await React.act(async () => button(label).click());
  }

  async function changeInput(label: string, value: string) {
    const input = Array.from(container.querySelectorAll('label'))
      .find((element) => element.textContent === label)
      ?.querySelector('input');
    if (!input) throw new Error(`Missing input: ${label}`);
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
        ?.set?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });
  }

  async function finishCapture(index: number, url: string) {
    await React.act(async () => captures[index].resolve(url));
    await React.act(async () => {
      container.querySelector('img')?.dispatchEvent(new Event('load'));
      await Promise.resolve();
    });
  }

  test('cancels pending work and ignores its late result, including when hidden', async () => {
    await render();
    await click('Capture');
    expect(button('Capturing…').disabled).toBe(true);
    expect(container.textContent).toContain('Capturing native screenshot');
    await click('Cancel');
    expect(captures[0].signal.aborted).toBe(true);
    expect(container.textContent).toContain('Capture cancelled.');
    await finishCapture(0, 'https://images.example/cancelled.bmp');
    expect(container.querySelector('img')).toBeNull();

    await click('Capture');
    await render({ active: false });
    expect(captures[1].signal.aborted).toBe(true);
    await finishCapture(1, 'https://images.example/hidden.bmp');
    await render({ active: true });
    expect(container.querySelector('img')).toBeNull();
    expect(button('Capture').disabled).toBe(false);
  });

  test('aborts outdated requests when the source or capture settings change', async () => {
    await render();
    await click('Capture');
    await render({ sourceKey: 'updated-preview' });
    expect(captures[0].signal.aborted).toBe(true);
    await finishCapture(0, 'https://images.example/old-source.bmp');
    expect(container.querySelector('img')).toBeNull();

    await click('Settings');
    await click('Capture');
    await changeInput('Width (px)', '400');
    expect(captures[1].signal.aborted).toBe(true);
    await finishCapture(1, 'https://images.example/old-settings.bmp');
    expect(container.querySelector('img')).toBeNull();
    await click('Capture');
    expect(captures[2].settings.width).toBe(400);
  });

  test('shows a failed capture and allows a successful retry', async () => {
    await render();
    await click('Capture');
    await React.act(async () =>
      captures[0].reject(new Error('Renderer unavailable.'))
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Renderer unavailable.',
    );
    await click('Capture');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await finishCapture(1, 'https://images.example/retry.bmp');
    expect(container.querySelector('img')?.src).toBe(
      'https://images.example/retry.bmp',
    );
    expect(container.querySelector('a')?.href).toBe(
      'https://images.example/retry.bmp',
    );
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      '390 × 700 px · Native Lynx',
    );
  });

  test('retains the previous image while recapturing and identifies outdated content', async () => {
    await render();
    await click('Capture');
    await finishCapture(0, 'https://images.example/first.bmp');
    await render({ sourceKey: 'updated-preview' });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Recapture to update',
    );
    expect(container.querySelector('img')?.alt).toContain(
      'previous preview or settings',
    );
    await click('Recapture');
    expect(container.querySelector('img')?.src).toBe(
      'https://images.example/first.bmp',
    );
    await React.act(async () =>
      captures[1].reject(new Error('Capture timed out.'))
    );
    expect(container.querySelector('img')?.src).toBe(
      'https://images.example/first.bmp',
    );
    await click('Recapture');
    await finishCapture(2, 'https://images.example/latest.bmp');
    expect(container.querySelector('img')?.src).toBe(
      'https://images.example/latest.bmp',
    );
    expect(container.textContent).not.toContain('Recapture to update');
  });

  test('waits for phone dimensions and rejects invalid custom sizes', async () => {
    await render({ phoneSize: { width: 0, height: 0 } });
    expect(button('Capture').disabled).toBe(true);
    await render({ phoneSize: { width: 390, height: 700 } });
    expect(button('Capture').disabled).toBe(false);
    await click('Settings');
    await changeInput('Width (px)', '8192');
    await changeInput('Height (px)', '8192');
    expect(button('Capture').disabled).toBe(true);
    expect(container.textContent).toContain('must not exceed 2,621,440 pixels');
    await click('Capture');
    expect(captures).toHaveLength(0);
    await changeInput('Width (px)', '');
    expect(button('Capture').disabled).toBe(true);
    await click('Use phone size');
    expect(button('Capture').disabled).toBe(false);
    await click('Capture');
    expect(captures[0].settings).toMatchObject({ width: 390, height: 700 });
  });
});
