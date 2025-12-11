// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '@lynx-js/web-elements-compat/LinearContainer';
import '@lynx-js/web-core-wasm/client';
import '@lynx-js/web-core-wasm/index.css';
import './index.css';

export const lynxViewTests = (
  callback: (lynxView: LynxView) => void,
  lynxView: LynxView | undefined,
) => {
  if (!lynxView) lynxView = document.createElement('lynx-view') as LynxView;
  lynxView.initData = { mockData: 'mockData' };
  lynxView.setAttribute('height', 'auto');
  lynxView.globalProps = { backgroundColor: 'pink' };
  lynxView.addEventListener('error', (e) => {
    console.log(e);
    lynxView.setAttribute('style', 'display:none');
    lynxView.innerHTML = '';
  });
  lynxView.addEventListener('timing', (ev) => {
    // @ts-expect-error
    globalThis.timing = Object.assign(globalThis.timing ?? {}, ev.detail);
  });
  callback(lynxView);
  if (!lynxView.parentElement) document.body.append(lynxView);

  Object.assign(globalThis, { lynxView });
};
