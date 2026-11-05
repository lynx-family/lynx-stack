// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { describe, expect, rstest, test } from '@rstest/core';
import { registerAddFontHandler } from '../ts/client/mainthread/crossThreadHandlers/registerAddFontHandler.js';
import { addFontEndpoint } from '../ts/client/endpoints.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';

class FakeFontFace {
  #settle: (() => void) | undefined;
  #loadPromise: Promise<void> | undefined;
  constructor(
    public family: string,
    public src: string,
    private failure?: unknown,
  ) {}
  /**
   * Like the real `FontFace.load()`, repeated calls hand back the same promise
   * instead of starting a second load.
   */
  load() {
    this.#loadPromise ??= this.failure
      ? Promise.reject(this.failure)
      : new Promise<void>((resolve) => {
        this.#settle = resolve;
      });
    return this.#loadPromise;
  }
  finishLoading() {
    this.#settle?.();
  }
}

/**
 * A stand-in for one host document: the `FontFace` constructor lives on the
 * document's own `defaultView`, and `document.fonts` is the set the handler
 * registers into. A fresh one per test doubles as a fresh key for the
 * handler's per-document bookkeeping.
 */
function createFakeDocument(failure?: unknown) {
  const added: FakeFontFace[] = [];
  const doc = {
    defaultView: {
      FontFace: class extends FakeFontFace {
        constructor(family: string, src: string) {
          super(family, src, failure);
        }
      },
    },
    fonts: { add: (fontFace: FakeFontFace) => added.push(fontFace) },
  };
  return { doc, added };
}

function registerHandlerFor(
  doc: unknown,
  onRegister?: (endpoint: { name: string }) => void,
) {
  let handler: (fontFace: unknown) => unknown = () => {
    throw new Error('addFont handler was never registered');
  };
  const rpc = {
    registerHandler: (
      endpoint: { name: string },
      fn: (fontFace: unknown) => unknown,
    ) => {
      onRegister?.(endpoint);
      handler = fn;
    },
  } as unknown as Rpc;
  registerAddFontHandler(
    rpc,
    { rootDom: { ownerDocument: doc } } as unknown as LynxViewInstance,
  );
  return (fontFace: unknown) => handler(fontFace);
}

/**
 * `registerAddFontHandler` is the main-thread side of `lynx.addFont()`. The
 * background thread has no DOM, so registering the `FontFace` has to happen
 * here, against the lynx-view's owner document — `document.fonts` isn't
 * scoped per shadow root, so that's also the document the rendered elements
 * actually resolve fonts against.
 */
describe('registerAddFontHandler', () => {
  test('registers a FontFace on the owner document and awaits it loading', async () => {
    let registeredEndpointName: string | undefined;
    const { doc, added } = createFakeDocument();
    const invoke = registerHandlerFor(doc, (endpoint) => {
      registeredEndpointName = endpoint.name;
    });
    expect(registeredEndpointName).toBe(addFontEndpoint.name);

    let settled = false;
    const returned = Promise.resolve(
      invoke({ 'font-family': 'CustomFont', 'src': 'url("xxx")' }),
    ).then(() => {
      settled = true;
    });

    expect(added).toHaveLength(1);
    expect(added[0]!.family).toBe('CustomFont');
    expect(added[0]!.src).toBe('url("xxx")');
    expect(settled).toBe(false);

    added[0]!.finishLoading();
    await returned;

    expect(settled).toBe(true);
  });

  test('registers the same font only once per document', async () => {
    // `document.fonts` outlives the card: a `lynx.reload()` re-runs the card's
    // `lynx.addFont()` calls against the same document, and appending the same
    // face again on every reload would grow the set without bound.
    const { doc, added } = createFakeDocument();
    const invoke = registerHandlerFor(doc);
    const descriptor = { 'font-family': 'CustomFont', 'src': 'url("xxx")' };

    const first = Promise.resolve(invoke(descriptor));
    const second = Promise.resolve(invoke(descriptor));
    expect(added).toHaveLength(1);

    added[0]!.finishLoading();
    await Promise.all([first, second]);

    // A different `src` for the same family is a different font, so it is
    // registered rather than silently ignored.
    const third = Promise.resolve(
      invoke({ 'font-family': 'CustomFont', 'src': 'url("yyy")' }),
    );
    expect(added).toHaveLength(2);
    added[1]!.finishLoading();
    await third;
  });

  test('logs but still settles when the font fails to load', async () => {
    const failure = new Error('network error');
    const { doc } = createFakeDocument(failure);
    const invoke = registerHandlerFor(doc);

    const consoleError = rstest.spyOn(console, 'error').mockImplementation(
      () => {},
    );

    await expect(
      invoke({ 'font-family': 'CustomFont', 'src': 'url("xxx")' }),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[1]).toBe(failure);

    consoleError.mockRestore();
  });
});
