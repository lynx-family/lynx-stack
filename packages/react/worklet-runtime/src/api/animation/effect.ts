// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Element } from '../element.js';

export class KeyframeEffect {
  public readonly target: Element;
  public readonly keyframes: Record<string, number | string>[];
  public readonly options: Record<string, number | string>;

  constructor(
    target: Element,
    keyframes: Record<string, number | string>[],
    options: Record<string, number | string>,
  ) {
    this.target = target;
    this.keyframes = keyframes;
    this.options = options;
  }
}
