/*
 * Copyright (C) 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JSRealm } from '../../types/index.js';
const existingScript = document.querySelector('script[nonce]') as
  | HTMLScriptElement
  | null;
const nonce = existingScript?.nonce || existingScript?.getAttribute('nonce');
/**
 * Creates a isolated JavaScript context for executing mts code.
 * This context has its own global variables and functions.
 */
export async function createIFrameRealm(parent: Node): Promise<JSRealm> {
  const iframe = document.createElement('iframe');
  const iframeReadyPromise = new Promise<void>((resolve) => {
    const listener = (event: MessageEvent) => {
      if (
        event.data === 'lynx:mtsready' && event.source === iframe.contentWindow
      ) {
        resolve();
        globalThis.removeEventListener('message', listener);
      }
    };
    globalThis.addEventListener('message', listener);
  });
  iframe.style.display = 'none';
  iframe.srcdoc = '<!DOCTYPE html><html><head><script nonce="' + nonce
    + '">parent.postMessage("lynx:mtsready","*")</script></head><body style="display:none"></body></html>';
  iframe.sandbox = 'allow-same-origin allow-scripts'; // Restrict capabilities for security
  iframe.loading = 'eager';
  parent.appendChild(iframe);
  await iframeReadyPromise;
  const iframeWindow = iframe.contentWindow! as unknown as typeof globalThis;
  const loadScript: (url: string) => Promise<unknown> = async (url) => {
    const script = iframe.contentDocument!.createElement('script');
    script.fetchPriority = 'high';
    script.defer = true;
    script.async = false;
    script.nonce = nonce || '';
    iframe.contentDocument!.head.appendChild(script);
    return new Promise(async (resolve, reject) => {
      script.onload = () => {
        const ret = iframeWindow?.module?.exports;
        iframeWindow.module = { exports: undefined };
        resolve(ret);
      };
      script.onerror = (err) =>
        reject(new Error(`Failed to load script: ${url}`, { cause: err }));
      iframeWindow.module = { exports: undefined };
      script.src = url;
    });
  };
  const loadScriptSync: (url: string) => unknown = (url) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false); // Synchronous request
    xhr.send(null);
    if (xhr.status === 200) {
      const script = iframe.contentDocument!.createElement('script');
      script.textContent = xhr.responseText;
      const previousModule = iframeWindow.module;
      const module = { exports: undefined as unknown };
      iframeWindow.module = module;
      try {
        iframe.contentDocument!.head.appendChild(script);
        return module.exports;
      } finally {
        // A nested load must return control to its caller's CommonJS module.
        iframeWindow.module = previousModule;
      }
    } else {
      throw new Error(`Failed to load script: ${url}`, { cause: xhr });
    }
  };
  return { globalWindow: iframeWindow, loadScript, loadScriptSync };
}

/** Copy host data using the receiving realm's array and object prototypes. */
export function cloneIntoRealm<T>(
  value: T,
  targetGlobal: JSRealm['globalWindow'],
): T {
  if (value === null || typeof value !== 'object') return value;
  const copies = new Map<object, object>();
  const copy = (source: unknown): unknown => {
    if (source === null || typeof source !== 'object') return source;
    const existing = copies.get(source);
    if (existing) return existing;

    let clone: object;
    if (Array.isArray(source)) {
      clone = new targetGlobal.Array(source.length);
    } else {
      const prototype = Object.getPrototypeOf(source);
      if (prototype === null) {
        clone = targetGlobal.Object.create(null);
      } else {
        // A host can supply plain data from another window.
        const constructor = Object.getOwnPropertyDescriptor(
          prototype,
          'constructor',
        )?.value;
        if (
          typeof constructor !== 'function'
          || Function.prototype.toString.call(constructor)
            !== Function.prototype.toString.call(Object)
        ) {
          return source;
        }
        clone = new targetGlobal.Object();
      }
    }

    copies.set(source, clone);
    for (const [key, child] of Object.entries(source)) {
      // Treat "__proto__" as ordinary payload data.
      Object.defineProperty(clone, key, {
        value: copy(child),
        configurable: true,
        enumerable: true,
        writable: true,
      });
    }
    return clone;
  };
  return copy(value) as T;
}
