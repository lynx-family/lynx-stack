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

export const lynxViewTests = (callback: (lynxView: LynxView) => void) => {
  const lynxView = document.createElement('lynx-view') as LynxView;
  lynxView.initData = { mockData: 'mockData' };
  lynxView.setAttribute('height', 'auto');
  lynxView.globalProps = { pink: 'pink' };
  lynxView.addEventListener('error', () => {
    lynxView.setAttribute('style', 'display:none');
    lynxView.innerHTML = '';
  });
  lynxView.addEventListener('timing', (ev) => {
    // @ts-expect-error
    globalThis.timing = Object.assign(globalThis.timing ?? {}, ev.detail);
  });
  callback(lynxView);
  document.body.append(lynxView);

  Object.assign(globalThis, { lynxView });
};
