import '../polyfill/shim.js';
import { stagger as staggerOriginal } from 'framer-motion/dom';
import type { AnimationSequence, ObjectTarget, SequenceOptions } from 'framer-motion/dom';
import { spring as springOrig } from 'motion-dom';
import type { AnimationOptions, AnimationPlaybackControlsWithThen, AnyResolvedKeyframe, DOMKeyframesDefinition, MapInputRange, Mixer, MotionValue, MotionValueOptions, SpringOptions, TransformOptions, UnresolvedValueKeyframe, ValueAnimationTransition } from 'motion-dom';
import { useMotionValueRefEvent } from '../hooks/useMotionEvent.js';
import type { ElementOrElements } from '../types/index.js';
/**
 * Animate a sequence
 */
declare function animate(sequence: AnimationSequence, options?: SequenceOptions): AnimationPlaybackControlsWithThen;
/**
 * Animate a string
 */
declare function animate(value: string, keyframes: DOMKeyframesDefinition, options?: AnimationOptions): AnimationPlaybackControlsWithThen;
/**
 * Animate a string
 */
declare function animate(value: string | MotionValue<string>, keyframes: string | UnresolvedValueKeyframe<string>[], options?: ValueAnimationTransition<string>): AnimationPlaybackControlsWithThen;
/**
 * Animate a number
 */
declare function animate(value: number | MotionValue<number>, keyframes: number | UnresolvedValueKeyframe<number>[], options?: ValueAnimationTransition<number>): AnimationPlaybackControlsWithThen;
/**
 * Animate a generic motion value
 */
declare function animate<V extends string | number>(value: V | MotionValue<V>, keyframes: V | UnresolvedValueKeyframe<V>[], options?: ValueAnimationTransition<V>): AnimationPlaybackControlsWithThen;
/**
 * Animate an object
 */
declare function animate<O extends {}>(object: O | O[], keyframes: ObjectTarget<O>, options?: AnimationOptions): AnimationPlaybackControlsWithThen;
/**
 * Animate a main thread element
 */
declare function animate(value: ElementOrElements, keyframes: DOMKeyframesDefinition, options?: AnimationOptions): AnimationPlaybackControlsWithThen;
declare function stagger(...args: Parameters<typeof staggerOriginal>): ReturnType<typeof staggerOriginal>;
declare function motionValue<V>(init: V, options?: MotionValueOptions): MotionValue<V>;
declare function spring(...args: Parameters<typeof springOrig>): ReturnType<typeof springOrig>;
declare function springValue<T extends AnyResolvedKeyframe>(source: T | MotionValue<T>, options?: SpringOptions): MotionValue<T>;
declare function mix<T>(from: T, to: T): Mixer<T>;
declare function mix(from: number, to: number, p: number): number;
declare function progress(from: number, to: number, value: number): number;
declare function clamp(min: number, max: number, v: number): number;
declare function mapValue<O>(inputValue: MotionValue<number>, inputRange: MapInputRange, outputRange: O[], options?: TransformOptions<O>): MotionValue<O>;
declare function transformValue<O>(transform: () => O): MotionValue<O>;
declare function styleEffect(subject: string | ElementOrElements, values: Record<string, MotionValue>): () => void;
export declare const noop: () => void;
export { animate, stagger, motionValue, spring, springValue, mix, progress, mapValue, clamp, transformValue, styleEffect, };
export { useMotionValueRefEvent };
