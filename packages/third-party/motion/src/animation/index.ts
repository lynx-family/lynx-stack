// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '../polyfill/shim.js';

import {
  animate as animateOriginal,
  stagger as staggerOriginal,
} from 'framer-motion/dom';
import type {
  AnimationOptions,
  AnimationPlaybackControlsWithThen,
  DOMKeyframesDefinition,
  ElementOrSelector,
} from 'motion-dom';

import type { ElementOrElements } from '../types/index.js';
import { registerCallable } from '../utils/registeredFunction.js';

let animateHandle: string;
let staggerHandle: string;

if (__MAIN_THREAD__) {
  animateHandle = registerCallable(animateOriginal, 'animate');
  staggerHandle = registerCallable(staggerOriginal, 'stagger');
} else {
  animateHandle = 'animate';
  staggerHandle = 'stagger';
}

function animate(
  element: ElementOrElements,
  keyframes: DOMKeyframesDefinition,
  options?: AnimationOptions,
): AnimationPlaybackControlsWithThen {
  'main thread';

  const elementNodes: ElementOrSelector = Array.isArray(element)
    ? element.map(el => new globalThis.ElementCompt(el))
    : new globalThis.ElementCompt(element);

  return globalThis.runOnRegistered<typeof animateOriginal>(animateHandle)(
    elementNodes,
    keyframes,
    options,
  );
}

function stagger(
  ...args: Parameters<typeof staggerOriginal>
): ReturnType<typeof staggerOriginal> {
  'main thread';
  return globalThis.runOnRegistered<typeof staggerOriginal>(staggerHandle)(
    ...args,
  );
}

export { animate, stagger };
