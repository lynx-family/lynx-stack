/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { templateXOverlayNg } from '@lynx-js/web-elements-template';
import {
  layoutChangeTarget,
  CommonEventsAndMethods,
} from '../common/CommonEventsAndMethods.js';
import { XOverlayAttributes } from './XOverlayAttributes.js';

import { Component } from '@lynx-js/web-elements-reactive';

@Component<typeof XOverlayNg>(
  'x-overlay-ng',
  [CommonEventsAndMethods, XOverlayAttributes],
  templateXOverlayNg,
)
export class XOverlayNg extends HTMLElement {
  get [layoutChangeTarget](): HTMLElement {
    return this.shadowRoot!.firstElementChild as HTMLElement;
  }
}
