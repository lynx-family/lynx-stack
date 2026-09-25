// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { describe, expect, test } from '@rstest/core';
import { registerAccessibilityAnnounceHandler } from '../ts/client/mainthread/crossThreadHandlers/registerAccessibilityAnnounceHandler.js';
import { accessibilityAnnounceEndpoint } from '../ts/client/endpoints.js';
import { ErrorCode } from '../ts/constants.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';

/**
 * `registerAccessibilityAnnounceHandler` is the main-thread side of
 * `lynx.accessibilityAnnounce()`: the background thread has no DOM, so the
 * actual ARIA live-region announcement has to happen here, where the
 * LynxView's shadow root lives.
 */
describe('registerAccessibilityAnnounceHandler', () => {
  function setup() {
    const host = document.createElement('div');
    const rootDom = host.attachShadow({ mode: 'open' });
    let handler: (
      content: string,
    ) => { code: ErrorCode } = () => {
      throw new Error('accessibilityAnnounce handler was never registered');
    };
    const rpc = {
      registerHandler: (
        endpoint: { name: string },
        fn: typeof handler,
      ) => {
        expect(endpoint.name).toBe(accessibilityAnnounceEndpoint.name);
        handler = fn;
      },
    } as unknown as Rpc;
    const lynxViewInstance = { rootDom } as unknown as LynxViewInstance;
    registerAccessibilityAnnounceHandler(rpc, lynxViewInstance);
    return { rootDom, invoke: (content: string) => handler(content) };
  }

  test('creates a visually-hidden aria-live region and announces the content', async () => {
    const { rootDom, invoke } = setup();

    const res = invoke('hello lynx');
    expect(res).toEqual({ code: ErrorCode.SUCCESS });

    const announcer = rootDom.querySelector(
      '[data-lynx-accessibility-announcer]',
    );
    expect(announcer).not.toBeNull();
    expect(announcer!.getAttribute('aria-live')).toBe('assertive');
    expect(announcer!.getAttribute('aria-atomic')).toBe('true');
    // Cleared synchronously; the real text lands after a microtask so a
    // change is always observable, even for repeated announcements.
    expect(announcer!.textContent).toBe('');

    await Promise.resolve();
    expect(announcer!.textContent).toBe('hello lynx');
  });

  test('reuses the same announcer element across calls', async () => {
    const { rootDom, invoke } = setup();

    invoke('first');
    await Promise.resolve();
    invoke('second');
    await Promise.resolve();

    const announcers = rootDom.querySelectorAll(
      '[data-lynx-accessibility-announcer]',
    );
    expect(announcers.length).toBe(1);
    expect(announcers[0]!.textContent).toBe('second');
  });

  test('re-announces identical content back-to-back', async () => {
    const { rootDom, invoke } = setup();

    invoke('same message');
    await Promise.resolve();
    const announcer = rootDom.querySelector(
      '[data-lynx-accessibility-announcer]',
    )!;
    expect(announcer.textContent).toBe('same message');

    invoke('same message');
    // Cleared immediately, so a screen reader observes a genuine change even
    // though the final text is identical to what was already there.
    expect(announcer.textContent).toBe('');
    await Promise.resolve();
    expect(announcer.textContent).toBe('same message');
  });

  test('only the latest of two rapid announcements wins', async () => {
    const { rootDom, invoke } = setup();

    invoke('stale');
    invoke('fresh');
    await Promise.resolve();

    const announcer = rootDom.querySelector(
      '[data-lynx-accessibility-announcer]',
    );
    expect(announcer!.textContent).toBe('fresh');
  });
});
