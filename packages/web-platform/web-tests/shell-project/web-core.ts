// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { LynxView } from '@lynx-js/web-core';
import '@lynx-js/web-core';
import '@lynx-js/web-elements/index.css';
import '@lynx-js/web-elements-compat/LinearContainer';
import '@lynx-js/web-core/index.css';
import './index.css';

const color_environment = URL.createObjectURL(
  new Blob(
    [`export default function(NapiModules, NapiModulesCall) {
  return {
    getColor() {
      NapiModules.color_methods.getColor({ color: 'green' }, color => {
        console.log(color);
      });
    },
    ColorEngine: class ColorEngine {
      getColor(name) {
        NapiModules.color_methods.getColor({ color: 'green' }, color => {
          console.log(color);
        });
      }
    },
  };
};`],
    { type: 'text/javascript' },
  ),
);

const color_methods = URL.createObjectURL(
  new Blob(
    [`export default function(NapiModules, NapiModulesCall) {
  return {
    async getColor(data, callback) {
      const color = await NapiModulesCall('getColor', data);
      callback(color);
    },
  };
};`],
    { type: 'text/javascript' },
  ),
);

async function run() {
  const lepusjs = '/resources/web-core.main-thread.json';
  const lynxView = document.createElement('lynx-view') as LynxView;
  lynxView.setAttribute('url', lepusjs);
  lynxView.initData = { mockData: 'mockData' };
  lynxView.globalProps = { pink: 'pink' };
  lynxView.height = 'auto';
  lynxView.napiModulesMap = {
    'color_environment': color_environment,
    'color_methods': color_methods,
  };
  lynxView.onNapiModulesCall = (name, data, moduleName) => {
    if (name === 'getColor' && moduleName === 'color_methods') {
      return { data: data.color };
    }
  };
  lynxView.addEventListener('error', () => {
    lynxView.setAttribute('style', 'display:none');
    lynxView.innerHTML = '';
  });
  lynxView.addEventListener('timing', (ev) => {
    // @ts-expect-error
    globalThis.timing = Object.assign(globalThis.timing ?? {}, ev.detail);
  });
  document.body.append(lynxView);

  Object.assign(globalThis, { lynxView });
}
run();
