// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  AnimationOptions,
  DOMKeyframesDefinition,
  MotionValue,
  ResolvedValues,
} from 'motion-dom';

import type { ComponentType, FunctionComponent } from '@lynx-js/react';
import type { CSSProperties, IntrinsicElements } from '@lynx-js/types';

export type MotionStyleValue =
  | string
  | number
  | MotionValue<string>
  | MotionValue<number>
  | null
  | undefined;

/** Styles accepted by declarative Motion components. */
export type MotionStyle =
  & {
    [Key in keyof CSSProperties]?:
      | CSSProperties[Key]
      | MotionValue<string>
      | MotionValue<number>;
  }
  & Partial<Record<`--${string}`, MotionStyleValue>>
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

/** Transition options passed to Motion's animation engine. */
export type MotionTransition = AnimationOptions;

/** Animatable style target for a declarative Motion component. */
export type MotionTarget = DOMKeyframesDefinition & {
  transition?: MotionTransition;
  transitionEnd?: ResolvedValues;
};

/** A named declarative target or a list of targets merged left-to-right. */
export type MotionDefinition = MotionTarget | string | string[];

/** A named target table. Function variants are resolved on the background thread. */
export type MotionVariants = Record<
  string,
  MotionTarget | ((custom: unknown) => MotionTarget)
>;

/** Pointer coordinates reported to declarative tap callbacks. */
export interface MotionTapInfo {
  point: { x: number; y: number };
}

/** Motion-specific props shared by all declarative Motion components. */
export interface MotionProps {
  /** Values rendered before the first animation starts. */
  initial?: MotionDefinition | false;
  /** Values animated whenever this target changes. */
  animate?: MotionDefinition;
  /** Whether parent variant labels propagate through this component. */
  inherit?: boolean;
  /** Values animated while the element is being pressed. */
  whileTap?: MotionDefinition;
  /** Values animated while a mouse-capable client hovers the element. */
  whileHover?: MotionDefinition;
  /** Called when a press starts. */
  onTapStart?: (event: unknown, info: MotionTapInfo) => void;
  /** Called when a press ends successfully. */
  onTap?: (event: unknown, info: MotionTapInfo) => void;
  /** Called when a press is cancelled. */
  onTapCancel?: (event: unknown, info: MotionTapInfo) => void;
  /** Called when hover starts on a mouse-capable client. */
  onHoverStart?: (event: unknown) => void;
  /** Called when hover ends on a mouse-capable client. */
  onHoverEnd?: (event: unknown) => void;
  /** Called when a declarative target starts animating. */
  onAnimationStart?: (definition: MotionDefinition) => void;
  /** Called after a declarative target finishes animating. */
  onAnimationComplete?: (definition: MotionDefinition) => void;
  /** Named targets referenced by declarative definition props. */
  variants?: MotionVariants;
  /** Value passed to function variants. */
  custom?: unknown;
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
