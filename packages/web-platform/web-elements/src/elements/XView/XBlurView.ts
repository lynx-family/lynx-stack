/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '@lynx-js/web-elements-reactive';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { BlurRadius } from './BlurRadius.js';

@Component<typeof XBlurView>(
  'x-blur-view',
  [CommonEventsAndMethods, BlurRadius],
  `<style id="dynamic-style"></style><slot></slot>`,
)
export class XBlurView extends HTMLElement {}
