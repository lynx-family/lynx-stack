// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createElement, useEffect, useRef } from 'react';

import '@lynx-js/web-elements/index.css';

import { createLocalLynxXmlSourcePayload } from '../utils/renderUrl.js';

interface LynxViewElement extends HTMLElement {
  url?: string;
}

interface LynxXmlViewProps {
  className?: string;
  source?: string;
  sourceUrl?: string;
  onLoad?: () => void;
}

let lynxWebRuntimePromise: Promise<void> | undefined;

function ensureLynxWebRuntime(): Promise<void> {
  lynxWebRuntimePromise ??= import('@lynx-js/web-core/client')
    .then(() => import('@lynx-js/web-elements/all'))
    .then(() => undefined);
  return lynxWebRuntimePromise;
}

function callLatestOnLoad(
  callbackRef: { current: (() => void) | undefined },
): void {
  callbackRef.current?.();
}

/**
 * Mount a Lynx XML artifact directly in a Web LynxView.
 *
 * LynxView exposes a URL input, so generated in-memory XML is represented by
 * an XML-only Blob URL. No A2UI/OpenUI payload or render bridge is involved.
 */
export function LynxXmlView(props: LynxXmlViewProps) {
  const { className, onLoad, source, sourceUrl } = props;
  const lynxViewRef = useRef<LynxViewElement | null>(null);
  const onLoadRef = useRef(onLoad);

  onLoadRef.current = onLoad;

  useEffect(() => {
    let active = true;
    let removeLoadListener: (() => void) | undefined;
    const localPayload = source === undefined
      ? undefined
      : createLocalLynxXmlSourcePayload(source, window.URL);
    const resolvedSourceUrl = sourceUrl ?? localPayload?.sourceUrl;

    if (resolvedSourceUrl) {
      void ensureLynxWebRuntime().then(() => {
        const lynxView = lynxViewRef.current;
        if (!active || !lynxView) return;

        const handleLoad = callLatestOnLoad.bind(undefined, onLoadRef);
        lynxView.addEventListener('load', handleLoad);
        removeLoadListener = () => {
          lynxView.removeEventListener('load', handleLoad);
        };
        lynxView.url = resolvedSourceUrl;
      });
    }

    return () => {
      active = false;
      removeLoadListener?.();
      localPayload?.dispose();
    };
  }, [source, sourceUrl]);

  return createElement('lynx-view', {
    ref: lynxViewRef,
    className,
    'thread-strategy': 'multi-thread',
    'transform-vh': 'true',
    'transform-vw': 'true',
  });
}
