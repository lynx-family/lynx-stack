// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useEffect } from 'react';

import { useBundledRender } from './bundled.js';
import {
  OPENUI_RENDER_ERRORS_MESSAGE_TYPE,
  readOpenUIRenderErrors,
} from '../../lynx-src/openui/renderErrors.js';

export function OpenUIRender() {
  const {
    view,
    initData,
    setInitData,
    lynxViewRef,
    previewNavigationToken,
  } = useBundledRender();

  useEffect(() => {
    const rawTextUrl = initData?.rawTextUrl;
    if (!rawTextUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await window.fetch(rawTextUrl);
        if (!res.ok || cancelled) return;
        const rawText = await res.text();
        if (!cancelled) {
          setInitData(prev =>
            prev && prev.rawTextUrl === rawTextUrl
              ? { ...prev, rawText }
              : prev
          );
        }
      } catch {
        // ignore; the Lynx app will keep its fallback scenario
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initData?.rawTextUrl, setInitData]);

  useEffect(() => {
    const lynxView = lynxViewRef.current;
    if (!lynxView) return;
    lynxView.onNativeModulesCall = (name, data, moduleName) => {
      if (moduleName !== 'bridge') return;
      if (name === 'OPENUI_USER_ACTION') {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'OPENUI_USER_ACTION',
            action: data,
          }, '*');
        }
      } else if (name === OPENUI_RENDER_ERRORS_MESSAGE_TYPE) {
        const errors = readOpenUIRenderErrors(data);
        if (errors && window.parent !== window) {
          window.parent.postMessage({
            type: OPENUI_RENDER_ERRORS_MESSAGE_TYPE,
            navigationToken: previewNavigationToken,
            errors,
          }, '*');
        }
      }
    };
    return () => {
      lynxView.onNativeModulesCall = undefined;
    };
  }, [lynxViewRef, previewNavigationToken]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.data && typeof event.data === 'object'
        && 'type' in event.data && event.data.type === 'OPENUI_USER_ACTION'
        && window.parent && window.parent !== window
      ) {
        window.parent.postMessage(event.data, '*');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return view;
}
