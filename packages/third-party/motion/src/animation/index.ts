// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '../polyfill/shim.js';

import {
  animate as animateOriginal,
  stagger as staggerOriginal,
} from 'framer-motion/dom';
import {
  mix as mixOrig,
  motionValue as motionValueOrig,
  spring as springOrig,
  springValue as springValueOrig,
} from 'motion-dom';
import type {
  AnimationOptions,
  AnimationPlaybackControlsWithThen,
  AnyResolvedKeyframe,
  DOMKeyframesDefinition,
  ElementOrSelector,
  Mixer,
  MotionValue,
  MotionValueOptions,
  SpringOptions,
} from 'motion-dom';

import type { ElementOrElements } from '../types/index.js';
import { registerCallable } from '../utils/registeredFunction.js';

let animateHandle: string;
let staggerHandle: string;
let motionValueHandle: string;
let springHandle: string;
let springValueHandle: string;
let mixHandle: string;

if (__MAIN_THREAD__) {
  animateHandle = registerCallable(animateOriginal, 'animate');
  staggerHandle = registerCallable(staggerOriginal, 'stagger');
  motionValueHandle = registerCallable(motionValueOrig, 'motionValue');
  springHandle = registerCallable(springOrig, 'spring');
  springValueHandle = registerCallable(springValueOrig, 'springValue');
  mixHandle = registerCallable(mixOrig, 'mix');
} else {
  animateHandle = 'animate';
  staggerHandle = 'stagger';
  motionValueHandle = 'motionValue';
  springHandle = 'spring';
  springValueHandle = 'springValue';
  mixHandle = 'mix';
}

/**
 * Animate a string
 */
function animate(
  value: string,
  keyframes: DOMKeyframesDefinition,
  options?: AnimationOptions,
): AnimationPlaybackControlsWithThen;

/**
 * Animate a main thread element
 */
function animate(
  value: ElementOrElements,
  keyframes: DOMKeyframesDefinition,
  options?: AnimationOptions,
): AnimationPlaybackControlsWithThen;

function animate(
  element: ElementOrElements | string,
  keyframes: DOMKeyframesDefinition,
  options?: AnimationOptions,
): AnimationPlaybackControlsWithThen {
  'main thread';

  let originalElementNodes: ElementOrElements;

  if (typeof element === 'string') {
    originalElementNodes = lynx.querySelectorAll(element);
  } else {
    originalElementNodes = element;
  }

  const elementNodes = (Array.isArray(originalElementNodes)
    ? originalElementNodes.map(el => new globalThis.ElementCompt(el))
    : new globalThis.ElementCompt(
      originalElementNodes,
    )) as unknown as ElementOrSelector;

  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
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
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return globalThis.runOnRegistered<typeof staggerOriginal>(staggerHandle)(
    ...args,
  );
}

function motionValue<V>(
  init: V,
  options?: MotionValueOptions,
): MotionValue<V> {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return globalThis.runOnRegistered<typeof motionValueOrig>(motionValueHandle)(
    init,
    options,
  );
}

function spring(
  ...args: Parameters<typeof springOrig>
): ReturnType<typeof springOrig> {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return globalThis.runOnRegistered<typeof springOrig>(springHandle)(...args);
}

function springValue<T extends AnyResolvedKeyframe>(
  source: T | MotionValue<T>,
  options?: SpringOptions,
): MotionValue<T> {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return globalThis.runOnRegistered<typeof springValueOrig>(springValueHandle)(
    source,
    options,
  );
}

function mix<T>(from: T, to: T): Mixer<T> {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return globalThis.runOnRegistered<typeof mixOrig>('mix')(from, to);
}

export { animate, stagger, motionValue, spring, springValue, mix };
