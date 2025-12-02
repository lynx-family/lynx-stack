// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '../polyfill/shim.js';

import {
  animate as animateOriginal,
  clamp as clampOrig,
  progress as progressOrig,
  stagger as staggerOriginal,
} from 'framer-motion/dom';
import type {
  AnimationSequence,
  ObjectTarget,
  SequenceOptions,
} from 'framer-motion/dom';
import {
  mapValue as mapValueOrig,
  mix as mixOrig,
  spring as springOrig,
  springValue as springValueOrig,
  styleEffect as styleEffectOrig,
  transformValue as transformValueOrig,
} from 'motion-dom';
import type {
  AnimationOptions,
  AnimationPlaybackControlsWithThen,
  AnyResolvedKeyframe,
  DOMKeyframesDefinition,
  ElementOrSelector,
  MapInputRange,
  Mixer,
  MotionValue,
  MotionValueOptions,
  SpringOptions,
  TransformOptions,
  UnresolvedValueKeyframe,
  ValueAnimationTransition,
} from 'motion-dom';

import { useMotionValueRefEvent } from '../hooks/useMotionEvent.js';
import { motionValue as motionValueOrig } from '../polyfill/MotionValue.js';
import type { ElementOrElements } from '../types/index.js';
import { elementOrSelector2Dom } from '../utils/elementHelper.js';
import {
  isMainThreadElement,
  isMainThreadElementArray,
} from '../utils/isMainThreadElement.js';
import { registerCallable } from '../utils/registeredFunction.js';

let animateHandle: string;
let staggerHandle: string;
let motionValueHandle: string;
let springHandle: string;
let springValueHandle: string;
let mixHandle: string;
let progressHandle: string;
let clampHandle: string;
let mapValueHandle: string;
let transformValueHandle: string;
let styleEffectHandle: string;

if (__MAIN_THREAD__) {
  animateHandle = registerCallable(animateOriginal, 'animate');
  staggerHandle = registerCallable(staggerOriginal, 'stagger');
  motionValueHandle = registerCallable(motionValueOrig, 'motionValue');
  springHandle = registerCallable(springOrig, 'spring');
  springValueHandle = registerCallable(springValueOrig, 'springValue');
  mixHandle = registerCallable(mixOrig, 'mix');
  progressHandle = registerCallable(progressOrig, 'progress');
  clampHandle = registerCallable(clampOrig, 'clamp');
  mapValueHandle = registerCallable(mapValueOrig, 'mapValue');
  transformValueHandle = registerCallable(transformValueOrig, 'transformValue');
  styleEffectHandle = registerCallable(styleEffectOrig, 'styleEffect');
} else {
  animateHandle = 'animate';
  staggerHandle = 'stagger';
  motionValueHandle = 'motionValue';
  springHandle = 'spring';
  springValueHandle = 'springValue';
  mixHandle = 'mix';
  progressHandle = 'progress';
  clampHandle = 'clamp';
  mapValueHandle = 'mapValue';
  transformValueHandle = 'transformValue';
  styleEffectHandle = 'styleEffect';
}

/**
 * Animate a sequence
 */
function animate(
  sequence: AnimationSequence,
  options?: SequenceOptions,
): AnimationPlaybackControlsWithThen;

/**
 * Animate a string
 */
function animate(
  value: string,
  keyframes: DOMKeyframesDefinition,
  options?: AnimationOptions,
): AnimationPlaybackControlsWithThen;

/**
 * Animate a string
 */
function animate(
  value: string | MotionValue<string>,
  keyframes: string | UnresolvedValueKeyframe<string>[],
  options?: ValueAnimationTransition<string>,
): AnimationPlaybackControlsWithThen;
/**
 * Animate a number
 */
function animate(
  value: number | MotionValue<number>,
  keyframes: number | UnresolvedValueKeyframe<number>[],
  options?: ValueAnimationTransition<number>,
): AnimationPlaybackControlsWithThen;
/**
 * Animate a generic motion value
 */
function animate<V extends string | number>(
  value: V | MotionValue<V>,
  keyframes: V | UnresolvedValueKeyframe<V>[],
  options?: ValueAnimationTransition<V>,
): AnimationPlaybackControlsWithThen;

/**
 * Animate an object
 */
function animate<O extends {}>(
  object: O | O[],
  keyframes: ObjectTarget<O>,
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

function animate<O extends {}>(
  subjectOrSequence:
    | MotionValue<number>
    | MotionValue<string>
    | number
    | string
    | ElementOrElements
    | O
    | O[]
    | AnimationSequence,
  optionsOrKeyframes?:
    | number
    | string
    | UnresolvedValueKeyframe<number>[]
    | UnresolvedValueKeyframe<string>[]
    | DOMKeyframesDefinition
    | ObjectTarget<O>
    | SequenceOptions,
  options?:
    | ValueAnimationTransition<number>
    | ValueAnimationTransition<string>
    | AnimationOptions,
): AnimationPlaybackControlsWithThen {
  'main thread';

  let realSubjectOrSequence:
    | AnimationSequence
    | MotionValue<number>
    | MotionValue<string>
    | number
    | string
    | ElementOrSelector
    | O
    | O[];

  if (
    typeof subjectOrSequence === 'string'
    || isMainThreadElement(subjectOrSequence)
    || isMainThreadElementArray(subjectOrSequence)
  ) {
    let elementNodes: ElementOrElements;
    if (typeof subjectOrSequence === 'string') {
      elementNodes = lynx.querySelectorAll(subjectOrSequence);
    } else {
      elementNodes = subjectOrSequence;
    }
    realSubjectOrSequence = (Array.isArray(elementNodes)
      ? elementNodes.map(el => new globalThis.ElementCompt(el))
      : new globalThis.ElementCompt(
        elementNodes,
      )) as unknown as ElementOrSelector;
  } else {
    realSubjectOrSequence = subjectOrSequence;
  }

  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return globalThis.runOnRegistered<typeof animateOriginal>(animateHandle)(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    realSubjectOrSequence as any,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    optionsOrKeyframes as any,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    options as any,
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

function mix<T>(from: T, to: T): Mixer<T>;
function mix(from: number, to: number, p: number): number;
function mix<T>(from: T, to: T, p?: T): Mixer<T> | number {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
   
  return globalThis.runOnRegistered<typeof mixOrig>(mixHandle)(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    from as any,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    to as any,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    p as any,
  );
}

function progress(from: number, to: number, value: number): number {
  'main thread';
  return globalThis.runOnRegistered<typeof progressOrig>(progressHandle)(
    from,
    to,
    value,
  );
}

function clamp(min: number, max: number, v: number): number {
  'main thread';
  return globalThis.runOnRegistered<typeof clampOrig>(clampHandle)(min, max, v);
}

function mapValue<O>(
  inputValue: MotionValue<number>,
  inputRange: MapInputRange,
  outputRange: O[],
  options?: TransformOptions<O>,
): MotionValue<O> {
  'main thread';
  return globalThis.runOnRegistered<typeof mapValueOrig>(mapValueHandle)(
    inputValue,
    inputRange,
    outputRange,
    options,
  );
}

function transformValue<O>(transform: () => O): MotionValue<O> {
  'main thread';
  return globalThis.runOnRegistered<typeof transformValueOrig>(
    transformValueHandle,
  )(transform);
}

function styleEffect(
  subject: string | ElementOrElements,
  values: Record<string, MotionValue>,
): () => void {
  'main thread';
  const elements = elementOrSelector2Dom(subject);
  if (!elements) {
    return () => {};
  }
  return globalThis.runOnRegistered<typeof styleEffectOrig>(styleEffectHandle)(
    elements,
    values,
  );
}

export const noop = (): void => {};

export {
  animate,
  stagger,
  motionValue,
  spring,
  springValue,
  mix,
  progress,
  mapValue,
  clamp,
  transformValue,
  styleEffect,
};
export { useMotionValueRefEvent };
