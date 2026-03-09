// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxViewElement as LynxView } from '@lynx-js/web-core-wasm/client';
import { lynxViewTests } from './lynx-view.ts';

const ENABLE_MULTI_THREAD = !!process.env.ENABLE_MULTI_THREAD;

const searchParams = new URLSearchParams(document.location.search);
const casename = searchParams.get('casename');
const casename2 = searchParams.get('casename2');
const hasdir = searchParams.get('hasdir') === 'true';
const isSSR = document.location.pathname.includes('ssr');

if (casename) {
  const dir = `/dist/${isSSR ? 'ssr/' : ''}${casename}${
    hasdir ? `/${casename}` : ''
  }`;
  const dir2 = `/dist/${isSSR ? 'ssr/' : ''}${casename2}${
    hasdir ? `/${casename2}` : ''
  }`;
  const lynxView = isSSR
    ? document.querySelector('lynx-view')! as LynxView
    : undefined;
  lynxViewTests(lynxView => {
    lynxView.setAttribute('url', `${dir}/index.web.json`);
    ENABLE_MULTI_THREAD
      ? lynxView.setAttribute('thread-strategy', 'multi-thread')
      : lynxView.setAttribute('thread-strategy', 'all-on-ui');
    lynxView.id = 'lynxview1';
    if (casename2) {
      lynxView.setAttribute('lynx-group-id', '2');
    }
    lynxView.injectStyleRules = [`.injected-style-rules{background:green}`];
    if (casename === 'api-nativemodules-call-delay') {
      setTimeout(() => {
        lynxView.onNativeModulesCall = (name, data, moduleName) => {
          if (name === 'getColor' && moduleName === 'CustomModule') {
            return data.color;
          }
          if (name === 'getColor' && moduleName === 'bridge') {
            return data.color;
          }
        };
      }, 2500);
    } else {
      lynxView.onNativeModulesCall = (name, data, moduleName) => {
        if (name === 'getColor' && moduleName === 'CustomModule') {
          return data.color;
        }
        if (name === 'getColor' && moduleName === 'bridge') {
          return data.color;
        }
      };
    }

    if (casename.includes('custom-template-loader')) {
      // custom template loader is not supported by web-core-wasm
    }

    if (casename === 'api-createLynxView-browserConfig') {
      lynxView.browserConfig = {
        pixelRatio: 1,
        pixelWidth: 1234,
        pixelHeight: 5678,
      };
    }
  }, lynxView);
  if (casename2) {
    lynxViewTests(lynxView2 => {
      lynxView2.id = 'lynxview2';
      lynxView2.setAttribute('url', `${dir2}/index.web.json`);
      lynxView2.setAttribute('lynx-group-id', '2');
    }, undefined);
  }
} else {
  console.warn('cannot find casename');
}
