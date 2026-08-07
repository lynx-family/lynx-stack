// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  AnimationPlaybackControlsWithThen,
  MotionValue,
} from 'motion-dom';

import type { ComponentType, FunctionComponent } from '@lynx-js/react';
import {
  createElement,
  runOnMainThread,
  useEffect,
  useMainThreadRef,
  useMemo,
} from '@lynx-js/react';
import type { IntrinsicElements, MainThread } from '@lynx-js/types';

import './mainThreadDependencies.js';
import {
  collectMotionValues,
  motionDefinitionKey,
  resolveInitialStyle,
  resolveInitialValues,
} from './style.js';
import type {
  MotionComponentProps,
  MotionFactory,
  MotionImageProps,
  MotionProps,
  MotionTarget,
  MotionTextProps,
  MotionTransition,
  MotionViewProps,
} from './types.js';
import {
  animate as animateValue,
  motionValue,
  styleEffect,
} from '../animation/index.js';

type PreparedHostProps = Record<string, unknown> & {
  style?: MotionProps['style'];
  'main-thread:ref': ReturnType<
    typeof useMainThreadRef<MainThread.Element | null>
  >;
};

function useMotionHostProps<Props extends MotionProps>(
  props: Props,
): PreparedHostProps {
  const {
    animate,
    initial,
    style,
    transition,
    'main-thread:ref': _externalMainThreadRef,
    ...hostProps
  } = props as Props & { 'main-thread:ref'?: unknown };
  const elementRef = useMainThreadRef<MainThread.Element | null>(null);
  const animationRef = useMainThreadRef<
    AnimationPlaybackControlsWithThen[]
  >([]);
  const generatedValuesRef = useMainThreadRef<
    Record<string, MotionValue<string | number>>
  >({});
  const styleCleanupRef = useMainThreadRef<(() => void) | null>(null);

  const animationKey = motionDefinitionKey({ animate, transition });
  const styleKey = motionDefinitionKey(style);
  const initialStyle = useMemo(
    () => resolveInitialStyle(style, initial),
    [initial, style],
  );
  const initialValues = useMemo(
    () => resolveInitialValues(style, initial),
    [initial, style],
  );
  const motionValues = useMemo(
    () => collectMotionValues(style),
    [styleKey],
  );

  useEffect(() => {
    if (!animate && Object.keys(motionValues).length === 0) {
      return;
    }
    // Worklet hydration replaces MainThreadValue handles in captured objects.
    // Capture a fresh record so Lynx for Web doesn't mutate the memoized source
    // that a later React render will reuse.
    const motionValueBindings = { ...motionValues };

    function updateMotionStyles(
      target: MotionTarget | undefined,
      options: MotionTransition | undefined,
      startingValues: Record<string, unknown>,
    ) {
      'main thread';

      for (const animation of animationRef.current) {
        animation.stop();
      }
      animationRef.current = [];
      styleCleanupRef.current?.();
      styleCleanupRef.current = null;

      if (!elementRef.current) {
        return;
      }

      const animateMotionValue = animateValue as unknown as (
        value: MotionValue<string | number>,
        keyframes: unknown,
        options: MotionTransition | undefined,
      ) => AnimationPlaybackControlsWithThen;
      const values = { ...motionValueBindings };
      if (target) {
        const targetValues = target as Record<string, unknown>;
        for (const key in targetValues) {
          if (!values[key]) {
            let value = generatedValuesRef.current[key];
            if (!value) {
              const targetValue = targetValues[key];
              let firstTarget: unknown = targetValue;
              if (Array.isArray(targetValue)) {
                const keyframes = targetValue as unknown[];
                firstTarget = keyframes.find(value => value !== null);
              }
              const initialValue = startingValues[key] ?? firstTarget;
              if (
                typeof initialValue !== 'string'
                && typeof initialValue !== 'number'
              ) {
                continue;
              }
              value = motionValue(initialValue);
              generatedValuesRef.current[key] = value;
            }
            values[key] = value;
          }
        }
      }

      if (Object.keys(values).length > 0) {
        styleCleanupRef.current = styleEffect(elementRef.current, values);
      }

      if (target) {
        const targetValues = target as Record<string, unknown>;
        for (const key in targetValues) {
          const value = values[key];
          const targetValue = targetValues[key];
          if (value && targetValue !== undefined) {
            animationRef.current.push(
              animateMotionValue(
                value,
                targetValue,
                options,
              ),
            );
          }
        }
      }
    }

    void runOnMainThread(updateMotionStyles)(
      animate,
      transition,
      initialValues,
    );

    function stopMotionStyles() {
      'main thread';
      for (const animation of animationRef.current) {
        animation.stop();
      }
      animationRef.current = [];
      styleCleanupRef.current?.();
      styleCleanupRef.current = null;
    }

    return () => {
      void runOnMainThread(stopMotionStyles)();
    };
    // Serialized targets and value IDs avoid restarting unchanged inline
    // definitions while keeping animate and style transforms in one renderer.
  }, [animationKey, styleKey]);

  return {
    ...hostProps,
    style: initialStyle,
    'main-thread:ref': elementRef,
  };
}

const MotionView: FunctionComponent<MotionViewProps> = (props) => {
  const hostProps = useMotionHostProps(props);
  return createElement('view', hostProps as IntrinsicElements['view']);
};

const MotionText: FunctionComponent<MotionTextProps> = (props) => {
  const hostProps = useMotionHostProps(props);
  return createElement('text', hostProps as IntrinsicElements['text']);
};

const MotionImage: FunctionComponent<MotionImageProps> = (props) => {
  const hostProps = useMotionHostProps(props);
  return createElement('image', hostProps as IntrinsicElements['image']);
};

function createMotionComponent<Props extends { style?: unknown }>(
  Component: ComponentType<Props>,
): FunctionComponent<MotionComponentProps<Props>> {
  const MotionComponent: FunctionComponent<MotionComponentProps<Props>> = (
    props,
  ) => {
    const hostProps = useMotionHostProps(props);
    return createElement(Component, hostProps as Props);
  };
  return MotionComponent;
}

export const motion: MotionFactory = {
  view: MotionView,
  text: MotionText,
  image: MotionImage,
  create: createMotionComponent,
};
