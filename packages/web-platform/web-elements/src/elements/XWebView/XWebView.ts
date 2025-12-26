/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, genDomGetter } from '../../element-reactive/index.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { templateXWebView } from '../htmlTemplates.js';
import { XWebViewAttribute } from './XWebViewAttribute.js';

@Component<typeof XWebView>(
  'x-webview',
  [CommonEventsAndMethods, XWebViewAttribute],
  templateXWebView,
)
export class XWebView extends HTMLElement {
  static readonly observedAttributes = ['webview-type'];

  #getWebView = genDomGetter<HTMLIFrameElement>(
    () => this.shadowRoot!,
    '#webview',
  );

  /**
   * @internal
   */
  readonly #handleLoad = () => {
    this.dispatchEvent(
      new CustomEvent('load', {
        bubbles: true,
        composed: true,
        detail: {
          url: this.#getWebView().src,
        },
      }),
    );
    this.dispatchEvent(
      new CustomEvent('bindload', {
        bubbles: true,
        composed: true,
        detail: {
          url: this.#getWebView().src,
        },
      }),
    );
  };

  /**
   * @internal
   */
  readonly #handleError = (e: ErrorEvent | Event) => {
    this.dispatchEvent(
      new CustomEvent('error', {
        bubbles: true,
        composed: true,
        detail: {
          errorMsg: (e as ErrorEvent).message || 'unknown error',
        },
      }),
    );
    this.dispatchEvent(
      new CustomEvent('binderror', {
        bubbles: true,
        composed: true,
        detail: {
          errorMsg: (e as ErrorEvent).message || 'unknown error',
        },
      }),
    );
  };

  /**
   * @internal
   */
  readonly #handleMessage = (e: MessageEvent) => {
    if (e.source !== this.#getWebView().contentWindow) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent('message', {
        bubbles: true,
        composed: true,
        detail: {
          msg: e.data, // compatible with bindmessage
          data: e.data, // standard CustomEvent
        },
      }),
    );
    this.dispatchEvent(
      new CustomEvent('bindmessage', {
        bubbles: true,
        composed: true,
        detail: {
          msg: e.data,
        },
      }),
    );
  };

  connectedCallback() {
    this.#getWebView().addEventListener('load', this.#handleLoad);
    this.#getWebView().addEventListener('error', this.#handleError);
    window.addEventListener('message', this.#handleMessage);
  }

  disconnectedCallback() {
    this.#getWebView().removeEventListener('load', this.#handleLoad);
    this.#getWebView().removeEventListener('error', this.#handleError);
    window.removeEventListener('message', this.#handleMessage);
  }

  get src() {
    return this.getAttribute('src');
  }

  set src(val: string | null) {
    if (val === null) {
      this.removeAttribute('src');
    } else {
      this.setAttribute('src', val);
    }
  }

  get html() {
    return this.getAttribute('html');
  }

  set html(val: string | null) {
    if (val === null) {
      this.removeAttribute('html');
    } else {
      this.setAttribute('html', val);
    }
  }

  reload() {
    // eslint-disable-next-line no-self-assign
    this.#getWebView().src = this.#getWebView().src;
  }
}
