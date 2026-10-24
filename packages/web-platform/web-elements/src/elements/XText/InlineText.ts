/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '../../element-reactive/index.js';
import { XTextSelectionEvents } from './XTextSelectionEvents.js';

/**
 * @deprecated Use x-text instead of inline-text.
 */
@Component<typeof InlineText>('inline-text', [XTextSelectionEvents])
export class InlineText extends HTMLElement {}
