/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '@lynx-js/web-elements-reactive';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { XFoldviewSlotNgTouchEventsHandler } from './XFoldviewSlotNgTouchEventsHandler.js';
import { slotKid, type XFoldviewNg } from './XFoldviewNg.js';

@Component<typeof XFoldviewSlotNg>(
  'x-foldview-slot-ng',
  [
    CommonEventsAndMethods,
    XFoldviewSlotNgTouchEventsHandler,
  ],
)
export class XFoldviewSlotNg extends HTMLElement {
  connectedCallback() {
    if (this.matches('x-foldview-ng>x-foldview-slot-ng:first-of-type')) {
      (this.parentElement as XFoldviewNg | null)![slotKid] = this;
    }
  }
}
