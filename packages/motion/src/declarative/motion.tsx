// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// This must be evaluated before Motion's runtime modules. In QuickJS,
// motion-dom reads queueMicrotask during module initialization.
import './mainThreadDependencies.js';

import { animate as animateValue } from 'motion' with { runtime: 'shared' };
import type {
  AnimationPlaybackControlsWithThen,
  MotionValue,
} from 'motion-dom';
import { motionValue, styleEffect } from 'motion-dom' with {
  runtime: 'shared',
};

import type { ComponentType, FunctionComponent } from '@lynx-js/react';
import {
  createElement,
  runOnMainThread,
  useEffect,
  useMainThreadRef,
  useMemo,
} from '@lynx-js/react';
import type { IntrinsicElements, MainThread } from '@lynx-js/types';

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

type PreparedHostProps = Record<string, unknown> & {
  style?: MotionProps['style'];
  'main-thread:ref': ReturnType<
    typeof useMainThreadRef<MainThread.Element | null>
  >;
};

type AnimateMotionTarget = (
  value: MotionValue<string | number> | Element,
  keyframes: unknown,
  options: MotionTransition | undefined,
) => AnimationPlaybackControlsWithThen;

function useMotionHostProps<Props extends MotionProps>(
  props: Props,
): PreparedHostProps {
  const {
    animate,
    initial,
    style,
    transition,
    whileTap,
    'main-thread:ref': _externalMainThreadRef,
    ...hostProps
  } = props as Props & { 'main-thread:ref'?: unknown };
  const elementRef = useMainThreadRef<MainThread.Element | null>(null);
  const animationRef = useMainThreadRef<
    AnimationPlaybackControlsWithThen[]
  >([]);
  const tapAnimationRef = useMainThreadRef<
    AnimationPlaybackControlsWithThen[]
  >([]);
  const generatedValuesRef = useMainThreadRef<
    Record<string, MotionValue<string | number>>
  >({});
  const styleCleanupRef = useMainThreadRef<(() => void) | null>(null);

  const animationKey = motionDefinitionKey({ animate, transition, whileTap });
  const styleKey = motionDefinitionKey(style);
  const initialStyle = useMemo(
    () => resolveInitialStyle(style, initial),
    [initial, style],
  );
  const initialValues = useMemo(
    () => resolveInitialValues(style, initial),
    [initial, style],
  );
  const workletTransition = useMemo(
    () =>
      transition?.repeat === Number.POSITIVE_INFINITY
        ? { ...transition, repeat: -1 }
        : transition,
    [transition],
  );
  const motionValues = useMemo(
    () => collectMotionValues(style),
    [styleKey],
  );

  useEffect(() => {
    if (!animate && !whileTap && Object.keys(motionValues).length === 0) {
      return;
    }
    // Worklet hydration replaces MainThreadValue handles in captured objects.
    // Capture a fresh record so Lynx for Web doesn't mutate the memoized source
    // that a later React render will reuse.
    const motionValueBindings = { ...motionValues };

    function updateMotionStyles(
      target: MotionTarget | undefined,
      interactionTarget: MotionTarget | undefined,
      options: MotionTransition | undefined,
      startingValues: Record<string, unknown>,
    ) {
      'main thread';

      for (const animation of animationRef.current) {
        animation.stop();
      }
      animationRef.current = [];
      for (const animation of tapAnimationRef.current) {
        animation.stop();
      }
      tapAnimationRef.current = [];
      styleCleanupRef.current?.();
      styleCleanupRef.current = null;

      if (!elementRef.current) {
        return;
      }

      const animateMotionValue = animateValue as unknown as AnimateMotionTarget;
      const resolvedOptions = options?.repeat === -1
        ? { ...options, repeat: Number.POSITIVE_INFINITY }
        : options;
      const values = { ...motionValueBindings };
      const targets = [target, interactionTarget];
      for (const definition of targets) {
        if (!definition) {
          continue;
        }
        const targetValues = definition as Record<string, unknown>;
        const isInteractionTarget = definition === interactionTarget;
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
              let initialValue = startingValues[key];
              if (
                initialValue === undefined
                && !isInteractionTarget
                && Array.isArray(targetValue)
              ) {
                initialValue = firstTarget;
              }
              let resolvedInitialValue = initialValue;
              if (resolvedInitialValue === undefined) {
                if (key.startsWith('scale') || key === 'opacity') {
                  resolvedInitialValue = 1;
                } else if (
                  key === 'x'
                  || key === 'y'
                  || key === 'z'
                  || key.startsWith('translate')
                  || key.startsWith('rotate')
                  || key.startsWith('skew')
                ) {
                  resolvedInitialValue = 0;
                } else {
                  resolvedInitialValue = firstTarget;
                }
              }
              if (
                typeof resolvedInitialValue !== 'string'
                && typeof resolvedInitialValue !== 'number'
              ) {
                continue;
              }
              value = motionValue(resolvedInitialValue);
              generatedValuesRef.current[key] = value;
            }
            values[key] = value;
          }
        }
      }

      if (Object.keys(values).length > 0) {
        // `mainThreadDependencies` installs ElementCompt as the main-thread
        // Element constructor. Construct it here instead of capturing another
        // package worklet: Lynx for Web currently leaves nested/cross-module
        // worklet references as non-callable descriptors.
        const ElementConstructor = globalThis.Element as unknown as new(
          element: MainThread.Element,
        ) => Element;
        const element = new ElementConstructor(elementRef.current);
        styleCleanupRef.current = styleEffect(element, values);
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
                resolvedOptions,
              ),
            );
          }
        }
      }
    }

    void runOnMainThread(updateMotionStyles)(
      animate,
      whileTap,
      workletTransition,
      initialValues,
    );

    function stopMotionStyles() {
      'main thread';
      for (const animation of animationRef.current) {
        animation.stop();
      }
      animationRef.current = [];
      for (const animation of tapAnimationRef.current) {
        animation.stop();
      }
      tapAnimationRef.current = [];
      styleCleanupRef.current?.();
      styleCleanupRef.current = null;
    }

    return () => {
      void runOnMainThread(stopMotionStyles)();
    };
    // Serialized targets and value IDs avoid restarting unchanged inline
    // definitions while keeping animate and style transforms in one renderer.
  }, [animationKey, styleKey]);

  function startTapAnimation(event: MainThread.TouchEvent) {
    'main thread';
    if (!whileTap) {
      return;
    }
    for (const animation of animationRef.current) {
      animation.stop();
    }
    animationRef.current = [];
    for (const animation of tapAnimationRef.current) {
      animation.stop();
    }
    tapAnimationRef.current = [];

    const animateMotionTarget = animateValue as unknown as AnimateMotionTarget;
    const resolvedTransition = workletTransition?.repeat === -1
      ? { ...workletTransition, repeat: Number.POSITIVE_INFINITY }
      : workletTransition;
    const isLynxForWeb = typeof SystemInfo !== 'undefined'
      && String(SystemInfo.platform) === 'web';
    if (isLynxForWeb) {
      const targetValues = whileTap as Record<string, unknown>;
      for (const key in targetValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        const targetValue = targetValues[key];
        if (value && targetValue !== undefined) {
          tapAnimationRef.current.push(
            animateMotionTarget(value, targetValue, resolvedTransition),
          );
        }
      }
      return;
    }
    const ElementConstructor = globalThis.Element as unknown as new(
      element: MainThread.Element,
    ) => Element;
    const element = new ElementConstructor(event.currentTarget);
    tapAnimationRef.current.push(
      animateMotionTarget(element, whileTap, resolvedTransition),
    );
  }

  function endTapAnimation(event: MainThread.TouchEvent) {
    'main thread';
    if (!whileTap) {
      return;
    }
    for (const animation of tapAnimationRef.current) {
      animation.stop();
    }
    tapAnimationRef.current = [];

    const targetValues = whileTap as Record<string, unknown>;
    const animateValues = animate as Record<string, unknown> | undefined;
    const animateMotionTarget = animateValue as unknown as AnimateMotionTarget;
    const resolvedTransition = workletTransition?.repeat === -1
      ? { ...workletTransition, repeat: Number.POSITIVE_INFINITY }
      : workletTransition;
    const restingValues: Record<string, unknown> = {};
    for (const key in targetValues) {
      let restingValue = animateValues?.[key] ?? initialValues[key];
      if (Array.isArray(restingValue)) {
        const keyframes = restingValue as unknown[];
        for (let index = keyframes.length - 1; index >= 0; index--) {
          if (keyframes[index] !== null && keyframes[index] !== undefined) {
            restingValue = keyframes[index];
            break;
          }
        }
      }
      if (restingValue === undefined) {
        restingValue = key.startsWith('scale') || key === 'opacity' ? 1 : 0;
      }
      if (restingValue !== undefined) {
        restingValues[key] = restingValue;
      }
    }
    const isLynxForWeb = typeof SystemInfo !== 'undefined'
      && String(SystemInfo.platform) === 'web';
    if (isLynxForWeb) {
      for (const key in restingValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        if (value) {
          tapAnimationRef.current.push(
            animateMotionTarget(value, restingValues[key], resolvedTransition),
          );
        }
      }
      return;
    }
    const ElementConstructor = globalThis.Element as unknown as new(
      element: MainThread.Element,
    ) => Element;
    const element = new ElementConstructor(event.currentTarget);
    tapAnimationRef.current.push(
      animateMotionTarget(element, restingValues, resolvedTransition),
    );
  }

  return {
    ...hostProps,
    style: initialStyle,
    'main-thread:ref': elementRef,
    ...(whileTap
      ? {
        'main-thread:bindtouchstart': startTapAnimation,
        'main-thread:bindtouchend': endTapAnimation,
        'main-thread:bindtouchcancel': endTapAnimation,
      }
      : {}),
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
