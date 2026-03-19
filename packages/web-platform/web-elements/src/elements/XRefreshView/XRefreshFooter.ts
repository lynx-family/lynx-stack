/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '../../element-reactive/index.js';
import { XRefreshSubElementIntersectionObserver } from './XRefreshSubElementIntersectionObserver.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { LinearContainer } from '../../compat/index.js';

@Component(
  'x-refresh-footer',
  [
    LinearContainer,
    CommonEventsAndMethods,
    XRefreshSubElementIntersectionObserver,
  ],
)
export class XRefreshFooter extends HTMLElement {
  connectedCallback() {
    this.setAttribute('slot', 'footer');
  }
}
