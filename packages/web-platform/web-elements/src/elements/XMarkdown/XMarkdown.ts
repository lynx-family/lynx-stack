/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '../../element-reactive/index.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { templateXMarkdown } from '../htmlTemplates.js';
import { XMarkdownAttributes } from './XMarkdownAttributes.js';

@Component<typeof XMarkdown>(
  'x-markdown',
  [CommonEventsAndMethods, XMarkdownAttributes],
  templateXMarkdown,
)
export class XMarkdown extends HTMLElement {}
