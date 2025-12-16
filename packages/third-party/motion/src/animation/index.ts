// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '../polyfill/shim.js';

// import {
//   animate as animateOrig,
//   clamp as clampOrig,
//   progress as progressOrig,
//   stagger as staggerOrig,
// } from 'framer-motion/dom';
// import type {
//   AnimationSequence,
//   ObjectTarget,
//   SequenceOptions,
// } from 'framer-motion/dom';
// import {
//   mapValue as mapValueOrig,
//   mix as mixOrig,
//   spring as springOrig,
//   springValue as springValueOrig,
//   styleEffect as styleEffectOrig,
//   transformValue as transformValueOrig,
// } from 'motion-dom';
import {
  animate as animateOrig,
  clamp as clampOrig,
  progress as progressOrig,
  stagger as staggerOrig,
} from 'framer-motion/dom' with { runtime: 'shared' };
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
} from 'motion-dom' with { runtime: 'shared' };
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
import { ElementCompt } from '../polyfill/element.js' with { runtime: 'shared' };
import { motionValue as motionValueOrig } from '../polyfill/MotionValue.js' with { runtime: 'shared' };
import type { ElementOrElements } from '../types/index.js';
import { elementOrSelector2Dom } from '../utils/elementHelper.js';
import {
  isMainThreadElement,
  isMainThreadElementArray,
} from '../utils/isMainThreadElement.js';

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
    console.log('elementNodes', elementNodes);
    realSubjectOrSequence = (Array.isArray(elementNodes)
      ? elementNodes.map(el => new ElementCompt(el))
      : new ElementCompt(
        elementNodes,
      )) as unknown as ElementOrSelector;
  } else {
    realSubjectOrSequence = subjectOrSequence;
  }

  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return animateOrig(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    realSubjectOrSequence as any,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    optionsOrKeyframes as any,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    options as any,
  );
}

function stagger(
  ...args: Parameters<typeof staggerOrig>
): ReturnType<typeof staggerOrig> {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return staggerOrig(
    ...args,
  );
}

function motionValue<V>(
  init: V,
  options?: MotionValueOptions,
): MotionValue<V> {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return motionValueOrig(
    init,
    options,
  );
}

function spring(
  ...args: Parameters<typeof springOrig>
): ReturnType<typeof springOrig> {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return springOrig(...args);
}

function springValue<T extends AnyResolvedKeyframe>(
  source: T | MotionValue<T>,
  options?: SpringOptions,
): MotionValue<T> {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return springValueOrig(
    source,
    options,
  );
}

function mix<T>(from: T, to: T): Mixer<T>;
function mix(from: number, to: number, p: number): number;
function mix<T>(from: T, to: T, p?: T): Mixer<T> | number {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module

  return mixOrig(
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
  return progressOrig(
    from,
    to,
    value,
  );
}

function clamp(min: number, max: number, v: number): number {
  'main thread';
  return clampOrig(min, max, v);
}

function mapValue<O>(
  inputValue: MotionValue<number>,
  inputRange: MapInputRange,
  outputRange: O[],
  options?: TransformOptions<O>,
): MotionValue<O> {
  'main thread';
  return mapValueOrig(
    inputValue,
    inputRange,
    outputRange,
    options,
  );
}

function transformValue<O>(transform: () => O): MotionValue<O> {
  'main thread';
  return transformValueOrig(transform);
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
  return styleEffectOrig(
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
