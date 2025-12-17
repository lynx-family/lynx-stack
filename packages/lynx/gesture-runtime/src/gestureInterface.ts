// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { MainThread } from '@lynx-js/types';

import type { BaseGesture } from './baseGesture.js';

export interface GestureKindSerialized {
  type: GestureTypeInner;
  waitFor: number[];
  continueWith: number[];
  simultaneousWith: number[];
  __isSerialized: true;
}

export interface GestureKind {
  __isGesture: true;
  type: GestureTypeInner;
  waitFor: GestureKind[];
  continueWith: GestureKind[];
  simultaneousWith: GestureKind[];
  toGestureArray: () => BaseGesture[];
  serialize: () => Record<string, unknown>;
}

/**
 * Base gesture change event interface.
 * All gesture-specific events extend this interface.
 */
export interface GestureChangeEvent {
  target: MainThread.Element;
  currentTarget: MainThread.Element;
  params: {
    pageX: number;
    pageY: number;
    timestamp: number;
    type: string;
    clientX: number;
    y: number;
    x: number;
    clientY: number;
  };
}

/**
 * Pan gesture change event with translation and velocity information.
 */
export interface PanGestureChangeEvent extends GestureChangeEvent {
  params: GestureChangeEvent['params'] & {
    scrollX: number;
    scrollY: number;
    isAtStart: boolean;
    isAtEnd: boolean;
  };
}

/**
 * Tap gesture change event with tap location and count information.
 */
export interface TapGestureChangeEvent extends GestureChangeEvent {}

/**
 * Long press gesture change event with press location and duration information.
 */
export interface LongPressGestureChangeEvent extends GestureChangeEvent {}

/**
 * Fling gesture change event with fling location and velocity information.
 */
export interface FlingGestureChangeEvent extends GestureChangeEvent {
  params: GestureChangeEvent['params'] & {
    scrollX: number;
    scrollY: number;
    deltaX: number;
    deltaY: number;
    isAtStart: boolean;
    isAtEnd: boolean;
  };
}

/**
 * Default gesture change event.
 * Uses the base GestureChangeEvent without additional properties.
 */
export interface DefaultGestureChangeEvent extends GestureChangeEvent {
  params: GestureChangeEvent['params'] & {
    scrollX: number;
    scrollY: number;
    deltaX: number;
    deltaY: number;
    isAtStart: boolean;
    isAtEnd: boolean;
  };
}

/**
 * Native gesture change event.
 * Uses the base GestureChangeEvent without additional properties.
 */
export interface NativeGestureChangeEvent extends GestureChangeEvent {
  // Uses base event properties
}

export enum SetGestureStateType {
  active = 1,
  fail = 2,
  end = 3,
}

export interface ConsumeGestureParams {
  inner?: boolean;
  consume?: boolean;
}

export enum LynxNativeIOSGestureRecognizer {
  Base = 'Base',
  Pan = 'Pan',
  LongPress = 'LongPress',
  Tap = 'Tap',
  Swipe = 'Swipe',
  ScreenEdgePan = 'ScreenEdgePan',
  Hover = 'Hover',
  Rotation = 'Rotation',
  Pinch = 'Pinch',
}

export interface InterceptGestureOptions {
  tag: number;
  class: string;
  type: LynxNativeIOSGestureRecognizer;
}

/**
 * Used internally, not meant to be public
 */
export interface InternalStateManager {
  active: (id: number) => void;
  fail: (id: number) => void;
  end: (id: number) => void;
  scrollBy: (deltaX: number, deltaY: number) => number[];
  __SetGestureState: (
    dom: FiberElement,
    id: number,
    type: SetGestureStateType,
  ) => void;
  __ConsumeGesture: (
    dom: FiberElement,
    id: number,
    params: ConsumeGestureParams,
  ) => void;
}

export interface StateManager {
  active: () => void;
  fail: () => void;
  end: () => void;
  consumeGesture: (shouldConsume: boolean) => void;
  interceptGesture: (shouldIntercept: boolean) => void;
}

export enum GestureTypeInner {
  COMPOSED = -1,
  PAN = 0,
  FLING = 1,
  DEFAULT = 2,
  TAP = 3,
  LONGPRESS = 4,
  ROTATION = 5,
  PINCH = 6,
  NATIVE = 7,
}

/**
 * Generic gesture callback type that receives typed events.
 * @template TEvent - The specific gesture event type
 */
export type GestureCallback<
  TEvent extends GestureChangeEvent = GestureChangeEvent,
> = (
  event: TEvent,
  stateManager: StateManager,
) => void;

export type GestureControlCallback = (
  event: GestureChangeEvent,
  stateManager: StateManager,
) => void;

export type GestureControlInternalCallback = (
  event: GestureChangeEvent,
  stateManager: InternalStateManager,
) => void;

/**
 * Base configuration interface for all gestures.
 * All gesture-specific configurations extend this interface.
 */
export interface BaseGestureConfig extends Record<string, unknown> {
  /** Whether the gesture is enabled. Defaults to true. */
  enabled?: boolean;
}

/**
 * Configuration interface for PanGesture.
 * Pan gesture recognizes pan (dragging) gestures.
 */
export interface PanGestureConfig extends BaseGestureConfig {
  /** Minimum distance (in points) that must be traveled before the gesture activates. Defaults to 0. */
  minDistance?: number;
  /** Active offset for X axis */
  activeOffsetX?: number;
  /** Active offset for Y axis */
  activeOffsetY?: number;
  /** Fail offset for X axis */
  failOffsetX?: number;
  /** Fail offset for Y axis */
  failOffsetY?: number;
}

/**
 * Configuration interface for TapGesture.
 * Tap gesture recognizes tap gestures.
 */
export interface TapGestureConfig extends BaseGestureConfig {
  /** Maximum duration (in milliseconds) for a tap. Defaults to 500ms. */
  maxDuration?: number;
  /** Maximum distance (in points) the touch can move and still be considered a tap. Defaults to 10. */
  maxDistance?: number;
  /** Number of taps required. Defaults to 1. */
  numberOfTaps?: number;
}

/**
 * Configuration interface for LongPressGesture.
 * Long press gesture recognizes long press gestures.
 */
export interface LongPressGestureConfig extends BaseGestureConfig {
  /** Minimum duration (in milliseconds) for a long press. Defaults to 500ms. */
  minDuration?: number;
  /** Maximum distance (in points) the touch can move and still be considered a long press. Defaults to 10. */
  maxDistance?: number;
}

/**
 * Configuration interface for FlingGesture.
 * Fling gesture recognizes fling (swipe) gestures.
 */
export interface FlingGestureConfig extends BaseGestureConfig {
  /** Direction of the fling gesture */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** Number of pointers (fingers) required. Defaults to 1. */
  numberOfPointers?: number;
}

/**
 * Configuration interface for DefaultGesture.
 * Default gesture is a basic gesture handler.
 */
export interface DefaultGestureConfig extends BaseGestureConfig {
  /** Tap slop value (in points). Defaults to 3. */
  tapSlop?: number;
}

/**
 * Configuration interface for NativeGesture.
 * Native gesture uses platform-specific gesture recognizers.
 */
export interface NativeGestureConfig extends BaseGestureConfig {
  // Native gesture uses base config only
}

/**
 * Generic base gesture callbacks interface.
 * @template TEvent - The specific gesture event type
 */
export interface BaseGestureCallbacks<
  TEvent extends GestureChangeEvent = GestureChangeEvent,
> {
  onBegin?: GestureCallback<TEvent>;
  onStart?: GestureCallback<TEvent>;
  onEnd?: GestureCallback<TEvent>;
  onTouchesDown?: GestureCallback<TEvent>;
  onTouchesMove?: GestureCallback<TEvent>;
  onTouchesUp?: GestureCallback<TEvent>;
  onTouchesCancel?: GestureCallback<TEvent>;
}

/**
 * Generic continuous gesture callbacks interface.
 * @template TEvent - The specific gesture event type
 */
export interface ContinuousGestureCallbacks<
  TEvent extends GestureChangeEvent = GestureChangeEvent,
> {
  onUpdate?: GestureCallback<TEvent>;
}

declare module '@lynx-js/types' {
  interface StandardProps {
    'main-thread:gesture'?: GestureKind;
  }
}
