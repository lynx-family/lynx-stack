// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import '@lynx-js/web-elements/index.css';

import { useEffect, useRef, useState } from 'react';

import { MAX_REACTLYNX_WEB_BUNDLE_BYTES } from '../utils/reactLynxPreview.js';
import {
  RENDER_METRIC_ID_QUERY_PARAM,
  RENDER_NAVIGATION_TOKEN_QUERY_PARAM,
} from '../utils/renderUrl.js';

function readBundleUrl(params: URLSearchParams): string | undefined {
  const value = params.get('bundleUrl');
  if (!value) return undefined;
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) || url.username || url.password
  ) {
    throw new Error('Invalid ReactLynx bundle URL');
  }
  return url.toString();
}

function installWorkerBootstrap(): () => void {
  const NativeWorker = window.Worker;
  const bootstrapUrls = new Set<string>();
  window.Worker = class extends NativeWorker {
    constructor(url: string | URL, options?: WorkerOptions) {
      const absolute = new URL(url, document.baseURI).toString();
      const bootstrap = window.URL.createObjectURL(
        new window.Blob(
          [
            `const load = self.importScripts.bind(self);
self.importScripts = (...urls) => load(...urls.map(url => new URL(url, ${
              JSON.stringify(absolute)
            }).href));
self.importScripts(${JSON.stringify(absolute)});`,
          ],
          { type: 'text/javascript' },
        ),
      );
      bootstrapUrls.add(bootstrap);
      super(bootstrap, { ...options, type: 'classic' });
      const release = () => {
        if (!bootstrapUrls.delete(bootstrap)) return;
        window.URL.revokeObjectURL(bootstrap);
      };
      this.addEventListener('message', release, { once: true });
      this.addEventListener('error', release, { once: true });
    }
  };
  return () => {
    window.Worker = NativeWorker;
    for (const url of bootstrapUrls) window.URL.revokeObjectURL(url);
    bootstrapUrls.clear();
  };
}

export function ReactLynxRender() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const controller = new AbortController();
    let bundleObjectUrl: string | undefined;
    let restoreWorker: (() => void) | undefined;
    let view: HTMLElement | undefined;
    void (async () => {
      const bundleUrl = readBundleUrl(params);
      if (!bundleUrl) throw new Error('Missing ReactLynx bundle URL');
      const response = await window.fetch(bundleUrl, {
        cache: 'force-cache',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error('Unable to load the ReactLynx preview bundle');
      }
      const contentLength = Number(response.headers.get('content-length'));
      if (
        Number.isFinite(contentLength)
        && contentLength > MAX_REACTLYNX_WEB_BUNDLE_BYTES
      ) {
        throw new Error('ReactLynx preview bundle is too large');
      }
      const data = await response.arrayBuffer();
      if (data.byteLength > MAX_REACTLYNX_WEB_BUNDLE_BYTES) {
        throw new Error('ReactLynx preview bundle is too large');
      }
      controller.signal.throwIfAborted();

      restoreWorker = installWorkerBootstrap();
      await Promise.all([
        import('@lynx-js/web-core/client'),
        import('@lynx-js/web-elements/all'),
      ]);
      controller.signal.throwIfAborted();

      const root = rootRef.current;
      if (!root) throw new Error('Missing preview root');
      view = document.createElement('lynx-view');
      view.className = 'renderLynx';
      view.setAttribute('thread-strategy', 'multi-thread');
      view.setAttribute('transform-vh', 'true');
      view.setAttribute('transform-vw', 'true');
      view.addEventListener('load', () => {
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => {
            window.parent.postMessage({
              type: 'A2UI_RENDER_READY',
              frameUrl: window.location.href,
              navigationToken: params.get(
                RENDER_NAVIGATION_TOKEN_QUERY_PARAM,
              ) ?? '',
            }, '*');
            const metricId = params.get(RENDER_METRIC_ID_QUERY_PARAM) ?? '';
            for (const metric of ['fcp', 'fmp']) {
              window.parent.postMessage({
                type: 'A2UI_PREVIEW_METRIC',
                metricId,
                metric,
                value: performance.now(),
              }, '*');
            }
          })
        );
      }, { once: true });
      view.addEventListener('error', () => {
        setError('Unable to load the ReactLynx preview bundle');
      }, { once: true });
      bundleObjectUrl = window.URL.createObjectURL(
        new window.Blob([data], { type: 'application/octet-stream' }),
      );
      view.setAttribute('url', bundleObjectUrl);
      root.replaceChildren(view);
    })().catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Preview failed');
      }
    });
    return () => {
      controller.abort();
      view?.remove();
      if (bundleObjectUrl) {
        window.URL.revokeObjectURL(bundleObjectUrl);
      }
      restoreWorker?.();
    };
  }, []);

  if (error) return <p>{error}</p>;
  return <div ref={rootRef} className='renderLynx' />;
}
