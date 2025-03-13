// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { LynxView } from '@lynx-js/web-core';
import '@lynx-js/web-core';
import '@lynx-js/web-elements/all';
import '@lynx-js/web-elements/index.css';
import '@lynx-js/web-elements-compat/LinearContainer';
import '@lynx-js/web-core/index.css';
import './index.css';

const userNativeModule = URL.createObjectURL(
  new Blob(
    [
      `export default {
  CustomModule: {
    async getColor(data, callback) {
      const color = await this.nativeModulesCall('getColor', data);
      callback(color);
    },
  }
};`,
    ],
    { type: 'text/javascript' },
  ),
);

async function run() {
  const searchParams = new URLSearchParams(document.location.search);
  const casename = searchParams.get('casename');
  const hasdir = searchParams.get('hasdir') === 'true';
  if (casename) {
    const dir = `/dist/${casename}${hasdir ? `/${casename}` : ''}`;
    const lepusjs = `${dir}/index.web.json`;
    const lynxView = document.createElement('lynx-view') as LynxView;
    lynxView.setAttribute('url', lepusjs);
    lynxView.initData = { mockData: 'mockData' };
    lynxView.globalProps = { pink: 'pink' };
    lynxView.height = 'auto';
    lynxView.addEventListener('error', () => {
      lynxView.setAttribute('style', 'display:none');
      lynxView.innerHTML = '';
    });
    lynxView.addEventListener('timing', (ev) => {
      // @ts-expect-error
      globalThis.timing = Object.assign(globalThis.timing ?? {}, ev.detail);
    });
    lynxView.nativeModulesUrl = userNativeModule;
    lynxView.onNativeModulesCall = (name, data, moduleName) => {
      if (name === 'getColor' && moduleName === 'CustomModule') {
        return data.color;
      }
      if (name === 'getColor' && moduleName === 'bridge') {
        return data.color;
      }
    };
    document.body.append(lynxView);

    Object.assign(globalThis, { lynxView });
  } else {
    console.warn('cannot find casename');
  }
}
run();
