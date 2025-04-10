// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { lynxViewTests } from './lynx-view.ts';

const nativeModulesMap = {
  CustomModule: URL.createObjectURL(
    new Blob(
      [
        `export default function(NativeModules, NativeModulesCall) {
    return {
      async getColor(data, callback) {
        const color = await NativeModulesCall('getColor', data);
        callback(color);
      },
    }
  };`,
      ],
      { type: 'text/javascript' },
    ),
  ),
};

const searchParams = new URLSearchParams(document.location.search);
const casename = searchParams.get('casename');
const casename2 = searchParams.get('casename2');
const hasdir = searchParams.get('hasdir') === 'true';

if (casename) {
  const dir = `/dist/${casename}${hasdir ? `/${casename}` : ''}`;
  const dir2 = `/dist/${casename2}${hasdir ? `/${casename2}` : ''}`;
  lynxViewTests(lynxView => {
    lynxView.setAttribute('url', `${dir}/index.web.json`);
    lynxView.nativeModulesMap = nativeModulesMap;
    lynxView.id = 'lynxview1';
    if (casename2) {
      lynxView.setAttribute('background-context-id', '2');
    }
    lynxView.onNativeModulesCall = (name, data, moduleName) => {
      if (name === 'getColor' && moduleName === 'CustomModule') {
        return data.color;
      }
      if (name === 'getColor' && moduleName === 'bridge') {
        return data.color;
      }
    };
  });
  if (casename2) {
    lynxViewTests(lynxView2 => {
      lynxView2.id = 'lynxview2';
      lynxView2.setAttribute('url', `${dir2}/index.web.json`);
      lynxView2.nativeModulesMap = nativeModulesMap;
      lynxView2.setAttribute('background-context-id', '2');
    });
  }
} else {
  console.warn('cannot find casename');
}
