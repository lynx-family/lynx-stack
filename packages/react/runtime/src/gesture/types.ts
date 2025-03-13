import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';

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

export interface GestureKind {
  type: GestureTypeInner;
  __isSerialized?: boolean;
  __isGesture?: boolean;
}

export interface ComposedGesture extends GestureKind {
  type: GestureTypeInner.COMPOSED;
  gestures: GestureKind[];
}

export interface BaseGesture extends GestureKind {
  id: number;
  callbacks: Record<string, Worklet>;
  waitFor: BaseGesture[];
  simultaneousWith: BaseGesture[];
  continueWith: BaseGesture[];
  config?: Record<string, unknown>;
}

export interface GestureConfig {
  callbacks: {
    name: string;
    callback: Worklet;
  }[];
  config?: Record<string, unknown>;
}
