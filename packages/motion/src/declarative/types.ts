// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  AnimationOptions,
  DOMKeyframesDefinition,
  MotionValue,
} from 'motion-dom';

import type { ComponentType, FunctionComponent } from '@lynx-js/react';
import type { CSSProperties, IntrinsicElements } from '@lynx-js/types';

export type MotionStyleValue =
  | string
  | number
  | MotionValue<string | number>
  | null
  | undefined;

/** Styles accepted by declarative Motion components. */
export type MotionStyle =
  & {
    [Key in keyof CSSProperties]?:
      | CSSProperties[Key]
      | MotionValue<string | number>;
  }
  & {
    x?: MotionStyleValue;
    y?: MotionStyleValue;
    z?: MotionStyleValue;
    scale?: MotionStyleValue;
    scaleX?: MotionStyleValue;
    scaleY?: MotionStyleValue;
    rotate?: MotionStyleValue;
    rotateX?: MotionStyleValue;
    rotateY?: MotionStyleValue;
    rotateZ?: MotionStyleValue;
  };

/** Animatable style target for a declarative Motion component. */
export type MotionTarget = DOMKeyframesDefinition;

/** Transition options passed to Motion's animation engine. */
export type MotionTransition = AnimationOptions;

/** Motion-specific props shared by all declarative Motion components. */
export interface MotionProps {
  /** Values rendered before the first animation starts. */
  initial?: MotionTarget | false;
  /** Values animated whenever this target changes. */
  animate?: MotionTarget;
  /** Values animated while the element is being pressed. */
  whileTap?: MotionTarget;
  /** Options used when animating to `animate`. */
  transition?: MotionTransition;
  /** Static styles and live MotionValue bindings. */
  style?: MotionStyle | string;
}

export type MotionComponentProps<Props> =
  & Omit<
    Props,
    keyof MotionProps | 'main-thread:ref'
  >
  & MotionProps;

export type MotionViewProps = MotionComponentProps<IntrinsicElements['view']>;
export type MotionTextProps = MotionComponentProps<IntrinsicElements['text']>;
export type MotionImageProps = MotionComponentProps<IntrinsicElements['image']>;

export interface MotionFactory {
  view: FunctionComponent<MotionViewProps>;
  text: FunctionComponent<MotionTextProps>;
  image: FunctionComponent<MotionImageProps>;
  create<Props extends { style?: unknown }>(
    Component: ComponentType<Props>,
  ): FunctionComponent<MotionComponentProps<Props>>;
}
