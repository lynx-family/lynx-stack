// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '../polyfill/shim.js';

import {
  animate as animate_,
  clamp as clamp_,
  progress as progress_,
  stagger as stagger_,
} from 'framer-motion/dom' with { runtime: 'shared' };
import type {
  AnimationSequence,
  ObjectTarget,
  SequenceOptions,
} from 'framer-motion/dom';
import {
  mapValue as mapValue_,
  mix as mix_,
  springValue as springValue_,
  spring as spring_,
  styleEffect as styleEffect_,
  transformValue as transformValue_,
} from 'motion-dom' with { runtime: 'shared' };
import type {
  AnimationOptions,
  AnimationPlaybackControlsWithThen,
  AnyResolvedKeyframe,
  DOMKeyframesDefinition,
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
import { motionValue as motionValue_ } from '../polyfill/MotionValue.js' with { runtime: 'shared' };
import type { ElementOrElements } from '../types/index.js';
import { elementOrSelector2Dom } from '../utils/elementHelper.js';
import { noopMT } from '../utils/noop.js';

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

  const realSubjectOrSequence =
    elementOrSelector2Dom(subjectOrSequence as ElementOrElements)
      ?? (subjectOrSequence as unknown);

  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return animate_(
    // @ts-expect-error expected
    realSubjectOrSequence,
    optionsOrKeyframes,
    options,
  );
}

function stagger(
  ...args: Parameters<typeof stagger_>
): ReturnType<typeof stagger_> {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return stagger_(
    ...args,
  );
}

function motionValue<V>(
  init: V,
  options?: MotionValueOptions,
): MotionValue<V> {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return motionValue_(
    init,
    options,
  );
}

function spring(
  ...args: Parameters<typeof spring_>
): ReturnType<typeof spring_> {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return spring_(...args);
}

function springValue<T extends AnyResolvedKeyframe>(
  source: T | MotionValue<T>,
  options?: SpringOptions,
): MotionValue<T> {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
  return springValue_(
    source,
    options,
  );
}

function mix<T>(from: T, to: T): Mixer<T>;
function mix(from: number, to: number, p: number): number;
function mix<T>(from: T, to: T, p?: T): Mixer<T> | number {
  'main thread';
  // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module

  return mix_(
    // @ts-expect-error expected
    from,
    to,
    p,
  );
}

function progress(from: number, to: number, value: number): number {
  'main thread';
  return progress_(
    from,
    to,
    value,
  );
}

function clamp(min: number, max: number, v: number): number {
  'main thread';
  return clamp_(min, max, v);
}

function mapValue<O>(
  inputValue: MotionValue<number>,
  inputRange: MapInputRange,
  outputRange: O[],
  options?: TransformOptions<O>,
): MotionValue<O> {
  'main thread';
  return mapValue_(
    inputValue,
    inputRange,
    outputRange,
    options,
  );
}

function transformValue<O>(transform: () => O): MotionValue<O> {
  'main thread';
  return transformValue_(transform);
}

function styleEffect(
  subject: string | ElementOrElements,
  values: Record<string, MotionValue>,
): () => void {
  'main thread';
  const elements = elementOrSelector2Dom(subject);
  if (!elements) {
    return noopMT;
  }
  return styleEffect_(
    elements,
    values,
  );
}

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
