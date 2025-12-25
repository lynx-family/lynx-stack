/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '@lynx-js/web-elements-reactive';
import { XRefreshSubElementIntersectionObserver } from './XRefreshSubElementIntersectionObserver.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';

@Component(
  'x-refresh-header',
  [
    CommonEventsAndMethods,
    XRefreshSubElementIntersectionObserver,
  ],
)
export class XRefreshHeader extends HTMLElement {
  connectedCallback() {
    this.setAttribute('slot', 'header');
  }
}
