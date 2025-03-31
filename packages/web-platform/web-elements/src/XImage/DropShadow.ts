/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  bindToStyle,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';

export class DropShadow
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = ['drop-shadow'];
  __dom: HTMLElement;

  __getImg = genDomGetter<HTMLImageElement>(
    () => this.__dom.shadowRoot!,
    '__img',
  );

  @registerAttributeHandler('drop-shadow', true)
  __handleBlurRadius = bindToStyle(
    this.__getImg,
    '--drop-shadow',
    undefined,
    true,
  );

  constructor(dom: HTMLElement) {
    this.__dom = dom;
  }
}
