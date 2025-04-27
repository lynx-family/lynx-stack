// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { LynxView } from '@lynx-js/web-core';
import '@lynx-js/web-core';
import '@lynx-js/web-elements/index.css';
import '@lynx-js/web-elements-compat/LinearContainer';
import '@lynx-js/web-core/index.css';
import './index.css';

const ALL_ON_UI = !!process.env.ALL_ON_UI;
const color_environment = URL.createObjectURL(
  new Blob(
    [`export default function(NapiModules, NapiModulesCall) {
  return {
    getColor() {
      NapiModules.color_methods.getColor({ color: 'green' }, data => {
        console.log(data.color);
        console.log(data.tagName);
      });
    },
    ColorEngine: class ColorEngine {
      getColor(name) {
        NapiModules.color_methods.getColor({ color: 'green' }, data => {
          console.log(data.color);
        console.log(data.tagName);
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
      const handledData = await NapiModulesCall('getColor', data);
      callback(handledData);
    },
  };
};`],
    { type: 'text/javascript' },
  ),
);
const event_method = URL.createObjectURL(
  new Blob(
    [`export default function(NapiModules, NapiModulesCall, handleDispatch) {
  return {
    async bindEvent() {
      await NapiModulesCall('bindEvent');
      handleDispatch((data) => console.log(\`bts:\${data}\`))
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
  if (ALL_ON_UI) lynxView.setAttribute('thread-strategy', `all-on-ui`);
  lynxView.initData = { mockData: 'mockData' };
  lynxView.globalProps = { pink: 'pink' };
  lynxView.height = 'auto';
  lynxView.napiModulesMap = {
    'color_environment': color_environment,
    'color_methods': color_methods,
    'event_method': event_method,
  };
  lynxView.onNapiModulesCall = (
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
  lynxView.addEventListener('timing', (ev) => {
    // @ts-expect-error
    globalThis.timing = Object.assign(globalThis.timing ?? {}, ev.detail);
  });
  document.body.append(lynxView);

  Object.assign(globalThis, { lynxView });
}
run();
