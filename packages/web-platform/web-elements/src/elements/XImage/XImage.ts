/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '../../element-reactive/index.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { ImageSrc } from './ImageSrc.js';
import { ImageEvents } from './ImageEvents.js';
import { templateXImage } from '../htmlTemplates.js';

@Component<typeof XImage>(
  'x-image',
  [CommonEventsAndMethods, ImageSrc, ImageEvents],
  templateXImage({}),
)
export class XImage extends HTMLElement {}
