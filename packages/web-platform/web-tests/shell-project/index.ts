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
const hasdir = searchParams.get('hasdir') === 'true';

if (casename) {
  const dir = `/dist/${casename}${hasdir ? `/${casename}` : ''}`;
  const lepusjs = `${dir}/index.web.json`;
  lynxViewTests(lynxView => {
    lynxView.setAttribute('url', lepusjs);
    lynxView.nativeModulesMap = nativeModulesMap;
    lynxView.onNativeModulesCall = (name, data, moduleName) => {
      if (name === 'getColor' && moduleName === 'CustomModule') {
        return data.color;
      }
      if (name === 'getColor' && moduleName === 'bridge') {
        return data.color;
      }
    };
  });
} else {
  console.warn('cannot find casename');
}
