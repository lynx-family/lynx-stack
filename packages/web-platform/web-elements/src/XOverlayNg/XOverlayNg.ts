/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { LynxExposure } from '../common/Exposure.js';
import { XOverlayAttributes } from './XOverlayAttributes.js';

import { Component, html } from '@lynx-js/web-elements-reactive';

@Component<typeof XOverlayNg>(
  'x-overlay-ng',
  [LynxExposure, XOverlayAttributes],
  html`
    <style>
      __dialog[open] {
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        position: fixed;
      }
      __dialog::backdrop {
        background-color: transparent;
      }
    </style>
    <dialog id="dialog" part="dialog">
      <slot></slot>
    </dialog>
  `,
)
export class XOverlayNg extends HTMLElement {}
