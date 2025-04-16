/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, html } from '@lynx-js/web-elements-reactive';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { CanvasAttributes } from './CanvasAttributes.js';

/**
 * @deprecated this proposals cannot be implemented on other platforms
 */
@Component<typeof XCanvas>(
  'x-canvas',
  [CommonEventsAndMethods, CanvasAttributes],
  html`<canvas id="canvas" part="canvas"></canvas>`,
)
export class XCanvas extends HTMLElement {}
