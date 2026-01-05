/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  registerAttributeHandler,
  bindToStyle,
  type AttributeReactiveClass,
} from '../../element-reactive/index.js';
import type { ListItem } from './ListItem.js';

export class ListItemAttributes
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'estimated-main-axis-size-px',
  ];

  #dom: ListItem;

  @registerAttributeHandler('estimated-main-axis-size-px', true)
  _handlerEstimatedMainAxisSizePx = bindToStyle(
    () => this.#dom,
    '--estimated-main-axis-size-px',
    (v) => `${parseFloat(v)}px`,
  );

  constructor(dom: ListItem) {
    this.#dom = dom;
  }
}
