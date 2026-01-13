/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import '@lynx-js/web-elements/XView';
import '@lynx-js/web-elements/XText';
import '@lynx-js/web-elements/XImage';
import '@lynx-js/web-elements/XSvg';
import '@lynx-js/web-elements/LynxWrapper';
import '@lynx-js/web-elements/ScrollView';

const loadedWebElementsCSSIds = new Set<number>();

export function loadWebElement(id: number): Promise<void> | undefined {
  if (loadedWebElementsCSSIds.has(id)) {
    return undefined;
  }
  let promise: Promise<unknown> | undefined = undefined;
  switch (id) {
    case 0:
      promise = import(
        /* webpackChunkName: "web-elements-list" */
        '@lynx-js/web-elements/XList'
      );

      break;
    case 1:
      promise = import(
        /* webpackChunkName: "web-elements-swiper" */
        '@lynx-js/web-elements/XSwiper'
      );
      break;
    case 2:
      promise = import(
        /* webpackChunkName: "web-elements-input" */
        '@lynx-js/web-elements/XInput'
      );
      break;
    case 3:
      promise = import(
        /* webpackChunkName: "web-elements-textarea" */
        '@lynx-js/web-elements/XTextarea'
      );
      break;
    case 4:
      promise = import(
        /* webpackChunkName: "web-elements-audio" */
        '@lynx-js/web-elements/XAudioTT'
      );
      break;
    case 5:
      promise = import(
        /* webpackChunkName: "web-elements-foldview" */
        '@lynx-js/web-elements/XFoldViewNg'
      );
      break;
    case 6:
      promise = import(
        /* webpackChunkName: "web-elements-refrshview" */
        '@lynx-js/web-elements/XRefreshView'
      );
      break;
    case 7:
      promise = import(
        /* webpackChunkName: "web-elements-overlay" */
        '@lynx-js/web-elements/XOverlayNg'
      );
      break;
    case 8:
      promise = import(
        /* webpackChunkName: "web-elements-viewpager" */
        '@lynx-js/web-elements/XViewpagerNg'
      );
      break;
    default:
  }
  return promise?.then(() => {
    loadedWebElementsCSSIds.add(id);
  });
}

export function loadAllWebElements(): Promise<void> {
  const promises: Promise<unknown>[] = [];
  for (let i = 0; i <= 8; i++) {
    const p = loadWebElement(i);
    if (p) {
      promises.push(p);
    }
  }
  return Promise.all(promises) as Promise<unknown> as Promise<void>;
}
