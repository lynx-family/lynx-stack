// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { LynxView } from '@lynx-js/web-core';
import '@lynx-js/web-core';
import '@lynx-js/web-elements/index.css';
import '@lynx-js/web-core/index.css';
import './index.css';

const ENABLE_MULTI_THREAD = !!process.env.ENABLE_MULTI_THREAD;
const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const searchParams = new URLSearchParams(document.location.search);
const casename = searchParams.get('casename');

async function run() {
  const lepusjs = '/resources/web-core.main-thread.json';
  const lynxView = document.createElement('lynx-view') as LynxView;
  if (casename === 'enable-css-selector-false') {
    lynxView.setAttribute(
      'url',
      '/resources/web-core.enable-css-selector-false.json',
    );
  } else {
    lynxView.setAttribute('url', lepusjs);
  }
  ENABLE_MULTI_THREAD
    ? lynxView.setAttribute('thread-strategy', 'multi-thread')
    : lynxView.setAttribute('thread-strategy', 'all-on-ui');
  lynxView.initData = { mockData: 'mockData' };
  lynxView.globalProps = { backgroundColor: 'pink' };
  lynxView.setAttribute('height', 'auto');
  lynxView.initI18nResources = [
    {
      options: {
        locale: 'en',
        channel: '1',
        fallback_url: '',
      },
      resource: {
        hello: 'hello',
        lynx: 'lynx web platform1',
      },
    },
  ];
  lynxView.onNapiModulesCall = async (
    name,
    data,
    moduleName,
    lynxView,
    dispatchNapiModules,
  ) => {
    if (name === 'getColor' && moduleName === 'color_methods') {
      return {
        data: { color: data.color, tagName: lynxView.tagName },
      };
    }
    if (name === 'bindEvent' && moduleName === 'event_method') {
      document.querySelector('lynx-view')?.addEventListener('click', () => {
        dispatchNapiModules('lynx-view');
      });
      return;
    }
  };
  lynxView.addEventListener('error', () => {
    lynxView.setAttribute('style', 'display:none');
    lynxView.innerHTML = '';
  });
  lynxView.addEventListener('i18nResourceMissed', (e) => {
    console.log(e);
  });
  lynxView.addEventListener('timing', (ev) => {
    // @ts-expect-error
    globalThis.timing = Object.assign(globalThis.timing ?? {}, ev.detail);
  });
  document.body.append(lynxView);

  Object.assign(globalThis, { lynxView });
}
run();
