// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { describe, expect, rstest, test } from '@rstest/core';
import { registerAddFontHandler } from '../ts/client/mainthread/crossThreadHandlers/registerAddFontHandler.js';
import { addFontEndpoint } from '../ts/client/endpoints.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';

/**
 * `registerAddFontHandler` is the main-thread side of `lynx.addFont()`. The
 * background thread has no DOM, so registering the `FontFace` has to happen
 * here, against the lynx-view's owner document — `document.fonts` isn't
 * scoped per shadow root, so that's also the document the rendered elements
 * actually resolve fonts against.
 */
describe('registerAddFontHandler', () => {
  test('registers a FontFace on the owner document and awaits it loading', async () => {
    let handler: (fontFace: unknown) => unknown = () => {
      throw new Error('addFont handler was never registered');
    };
    const rpc = {
      registerHandler: (
        endpoint: { name: string },
        fn: (fontFace: unknown) => unknown,
      ) => {
        expect(endpoint.name).toBe(addFontEndpoint.name);
        handler = fn;
      },
    } as unknown as Rpc;

    const added: unknown[] = [];
    let resolveLoad!: () => void;
    class FakeFontFace {
      family: string;
      src: string;
      constructor(family: string, src: string) {
        this.family = family;
        this.src = src;
      }
      load() {
        return new Promise<void>((resolve) => {
          resolveLoad = resolve;
        });
      }
    }
    const fontsAdd = rstest.fn((fontFace: unknown) => added.push(fontFace));
    const lynxViewInstance = {
      rootDom: {
        ownerDocument: {
          defaultView: { FontFace: FakeFontFace },
          fonts: { add: fontsAdd },
        },
      },
    } as unknown as LynxViewInstance;

    registerAddFontHandler(rpc, lynxViewInstance);

    let settled = false;
    const returned = Promise.resolve(
      handler({ 'font-family': 'CustomFont', 'src': 'url("xxx")' }),
    ).then(() => {
      settled = true;
    });

    expect(added).toHaveLength(1);
    expect((added[0] as FakeFontFace).family).toBe('CustomFont');
    expect((added[0] as FakeFontFace).src).toBe('url("xxx")');
    expect(settled).toBe(false);

    resolveLoad();
    await returned;

    expect(settled).toBe(true);
  });

  test('logs but still settles when the font fails to load', async () => {
    let handler: (fontFace: unknown) => unknown = () => {
      throw new Error('addFont handler was never registered');
    };
    const rpc = {
      registerHandler: (
        _endpoint: { name: string },
        fn: (fontFace: unknown) => unknown,
      ) => {
        handler = fn;
      },
    } as unknown as Rpc;

    const failure = new Error('network error');
    class FakeFontFace {
      constructor(
        public family: string,
        public src: string,
      ) {}
      load() {
        return Promise.reject(failure);
      }
    }
    const lynxViewInstance = {
      rootDom: {
        ownerDocument: {
          defaultView: { FontFace: FakeFontFace },
          fonts: { add: () => {} },
        },
      },
    } as unknown as LynxViewInstance;

    const consoleError = rstest.spyOn(console, 'error').mockImplementation(
      () => {},
    );

    registerAddFontHandler(rpc, lynxViewInstance);

    await expect(
      handler({ 'font-family': 'CustomFont', 'src': 'url("xxx")' }),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[1]).toBe(failure);

    consoleError.mockRestore();
  });
});
