/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '../../element-reactive/index.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { LinearContainer } from '../../compat/index.js';

@Component<typeof XFoldviewSlotDragNg>('x-foldview-slot-drag-ng', [
  LinearContainer,
  CommonEventsAndMethods,
])
export class XFoldviewSlotDragNg extends HTMLElement {}
