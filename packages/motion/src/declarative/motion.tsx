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
import {
  animateMotionValue as createMotionValueAnimation,
  motionValue,
  styleEffect,
} from 'motion-dom' with {
  runtime: 'shared',
};

import type { ComponentType, FunctionComponent } from '@lynx-js/react';
import {
  createElement,
  runOnBackground,
  runOnMainThread,
  useEffect,
  useMainThreadRef,
  useMemo,
  useRef,
} from '@lynx-js/react';
import type { IntrinsicElements, MainThread } from '@lynx-js/types';

import {
  collectMotionValues,
  motionDefinitionKey,
  resolveInitialStyle,
  resolveInitialValues,
  resolveMotionDefinition,
  splitMotionTarget,
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

type BackgroundTouchHandler = (event: unknown) => void;

function tapInfo(event: unknown) {
  const touchEvent = event as {
    detail?: { x?: unknown; y?: unknown };
    touches?: Array<{ clientX?: unknown; clientY?: unknown }>;
  };
  const touch = touchEvent.touches?.[0];
  const x = touchEvent.detail?.x ?? touch?.clientX;
  const y = touchEvent.detail?.y ?? touch?.clientY;
  return {
    point: {
      x: typeof x === 'number' ? x : 0,
      y: typeof y === 'number' ? y : 0,
    },
  };
}

function useMotionHostProps<Props extends MotionProps>(
  props: Props,
): PreparedHostProps {
  const {
    animate,
    initial,
    style,
    transition,
    whileTap,
    whileHover,
    variants,
    custom,
    onTapStart,
    onTap,
    onTapCancel,
    onHoverStart,
    onHoverEnd,
    onAnimationStart,
    onAnimationComplete,
    bindtouchstart: externalTouchStart,
    bindtouchend: externalTouchEnd,
    bindtouchcancel: externalTouchCancel,
    bindlayoutchange: externalLayoutChange,
    'global-bindmousemove': externalGlobalMouseMove,
    'main-thread:ref': _externalMainThreadRef,
    ...hostProps
  } = props as Props & {
    bindtouchstart?: BackgroundTouchHandler;
    bindtouchend?: BackgroundTouchHandler;
    bindtouchcancel?: BackgroundTouchHandler;
    bindlayoutchange?: BackgroundTouchHandler;
    'global-bindmousemove'?: BackgroundTouchHandler;
    'main-thread:ref'?: unknown;
  };
  const elementRef = useMainThreadRef<MainThread.Element | null>(null);
  const animationRef = useMainThreadRef<
    AnimationPlaybackControlsWithThen[]
  >([]);
  const tapAnimationRef = useMainThreadRef<
    AnimationPlaybackControlsWithThen[]
  >([]);
  const hoverActiveRef = useMainThreadRef(false);
  const tapActiveRef = useMainThreadRef(false);
  const animationGenerationRef = useMainThreadRef(0);
  const animateTargetKeysRef = useMainThreadRef<Record<string, true>>({});
  const hoverLayoutRef = useRef<
    { left: number; right: number; top: number; bottom: number } | null
  >(null);
  const hoverActiveBackgroundRef = useRef(false);
  const generatedValuesRef = useMainThreadRef<
    Record<string, MotionValue<string | number>>
  >({});
  const styleCleanupRef = useMainThreadRef<(() => void) | null>(null);
  const hasMountedAnimationRef = useRef(false);
  const hadAnimateTargetRef = useRef(false);

  const resolvedInitial = resolveMotionDefinition(initial, variants, custom);
  const resolvedAnimateDefinition = resolveMotionDefinition(
    animate,
    variants,
    custom,
  );
  const resolvedTapDefinition = resolveMotionDefinition(
    whileTap,
    variants,
    custom,
  );
  const resolvedHoverDefinition = resolveMotionDefinition(
    whileHover,
    variants,
    custom,
  );
  const resolvedInitialTarget = resolvedInitial === false
    ? false
    : splitMotionTarget(resolvedInitial, undefined).target;
  const resolvedAnimate = splitMotionTarget(
    resolvedAnimateDefinition,
    transition,
  );
  const resolvedTap = splitMotionTarget(resolvedTapDefinition, transition);
  const resolvedHover = splitMotionTarget(
    resolvedHoverDefinition,
    transition,
  );
  const animationKey = motionDefinitionKey({
    animate: resolvedAnimate,
    whileTap: resolvedTap,
    whileHover: resolvedHover,
  });
  const styleKey = motionDefinitionKey(style);
  const initialStyle = useMemo(
    () =>
      resolveInitialStyle(
        style,
        resolvedInitialTarget,
        resolvedAnimate.target,
      ),
    [resolvedAnimate.target, resolvedInitialTarget, style],
  );
  const initialValues = useMemo(
    () =>
      resolveInitialValues(
        style,
        resolvedInitialTarget,
        resolvedAnimate.target,
      ),
    [resolvedAnimate.target, resolvedInitialTarget, style],
  );
  const workletAnimateTransition = useMemo(
    () =>
      resolvedAnimate.transition?.repeat === Number.POSITIVE_INFINITY
        ? { ...resolvedAnimate.transition, repeat: -1 }
        : resolvedAnimate.transition,
    [resolvedAnimate.transition],
  );
  const workletTapTransition = useMemo(
    () =>
      resolvedTap.transition?.repeat === Number.POSITIVE_INFINITY
        ? { ...resolvedTap.transition, repeat: -1 }
        : resolvedTap.transition,
    [resolvedTap.transition],
  );
  const workletHoverTransition = useMemo(
    () =>
      resolvedHover.transition?.repeat === Number.POSITIVE_INFINITY
        ? { ...resolvedHover.transition, repeat: -1 }
        : resolvedHover.transition,
    [resolvedHover.transition],
  );
  const motionValues = useMemo(
    () => collectMotionValues(style),
    [styleKey],
  );

  const bindTouchStart = onTapStart || externalTouchStart
    ? (event: unknown) => {
      externalTouchStart?.(event);
      onTapStart?.(event, tapInfo(event));
    }
    : undefined;
  const bindTouchEnd = onTap || externalTouchEnd
    ? (event: unknown) => {
      externalTouchEnd?.(event);
      onTap?.(event, tapInfo(event));
    }
    : undefined;
  const bindTouchCancel = onTapCancel || externalTouchCancel
    ? (event: unknown) => {
      externalTouchCancel?.(event);
      onTapCancel?.(event, tapInfo(event));
    }
    : undefined;
  const hasHoverInteraction = [
    resolvedHover.target,
    onHoverStart,
    onHoverEnd,
  ].some(Boolean);
  const bindLayoutChange = hasHoverInteraction || externalLayoutChange
    ? (event: unknown) => {
      externalLayoutChange?.(event);
      if (!hasHoverInteraction) {
        return;
      }
      const detail = (event as {
        detail?: Record<string, unknown>;
      }).detail;
      if (
        typeof detail?.['left'] === 'number'
        && typeof detail['right'] === 'number'
        && typeof detail['top'] === 'number'
        && typeof detail['bottom'] === 'number'
      ) {
        hoverLayoutRef.current = {
          left: detail['left'],
          right: detail['right'],
          top: detail['top'],
          bottom: detail['bottom'],
        };
      }
    }
    : undefined;
  const bindGlobalMouseMove = hasHoverInteraction || externalGlobalMouseMove
    ? (event: unknown) => {
      externalGlobalMouseMove?.(event);
      const layout = hoverLayoutRef.current;
      if (!hasHoverInteraction || !layout) {
        return;
      }
      const mouseEvent = event as { x?: unknown; y?: unknown };
      const isInside = typeof mouseEvent.x === 'number'
        && typeof mouseEvent.y === 'number'
        && mouseEvent.x >= layout.left
        && mouseEvent.x <= layout.right
        && mouseEvent.y >= layout.top
        && mouseEvent.y <= layout.bottom;
      if (isInside === hoverActiveBackgroundRef.current) {
        return;
      }
      hoverActiveBackgroundRef.current = isInside;
      if (isInside) {
        onHoverStart?.(event);
        if (resolvedHover.target) {
          void runOnMainThread(startHoverAnimation)();
        }
      } else {
        onHoverEnd?.(event);
        if (resolvedHover.target) {
          void runOnMainThread(endHoverAnimation)();
        }
      }
    }
    : undefined;

  useEffect(() => {
    const hadAnimateTarget = hadAnimateTargetRef.current;
    hadAnimateTargetRef.current = Boolean(
      resolvedAnimate.target
        && Object.keys(resolvedAnimate.target).length > 0,
    );
    if (
      !resolvedAnimate.target
      && !resolvedTap.target
      && !resolvedHover.target
      && Object.keys(motionValues).length === 0
      && !hadAnimateTarget
    ) {
      return;
    }
    // Worklet hydration replaces MainThreadObject handles in captured objects.
    // Capture a fresh record so Lynx for Web doesn't mutate the memoized source
    // that a later React render will reuse.
    const motionValueBindings = { ...motionValues };
    const shouldAnimateTarget = resolvedInitialTarget !== false
      || hasMountedAnimationRef.current;
    hasMountedAnimationRef.current = true;

    function updateMotionStyles(
      target: MotionTarget | undefined,
      interactionTarget: MotionTarget | undefined,
      hoverTarget: MotionTarget | undefined,
      transitionEnd: Record<string, unknown> | undefined,
      options: MotionTransition | undefined,
      startingValues: Record<string, unknown>,
      shouldAnimate: boolean,
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
      const animationGeneration = animationGenerationRef.current + 1;
      animationGenerationRef.current = animationGeneration;
      styleCleanupRef.current?.();
      styleCleanupRef.current = null;

      if (!elementRef.current) {
        return;
      }

      const resolvedOptions = (options?.repeat === -1
        ? { ...options, repeat: Number.POSITIVE_INFINITY }
        : options) ?? {};
      const values = { ...motionValueBindings };
      const targetValues = (target ?? {}) as Record<string, unknown>;
      const animationTargetValues: Record<string, unknown> = {};
      for (const key in animateTargetKeysRef.current) {
        if (!(key in targetValues)) {
          if (startingValues[key] === undefined) {
            const retainedValue = generatedValuesRef.current[key];
            if (retainedValue) {
              retainedValue.stop();
              const retainedSnapshot = motionValue(retainedValue.get());
              generatedValuesRef.current[key] = retainedSnapshot;
              values[key] = retainedSnapshot;
            }
          } else {
            animationTargetValues[key] = startingValues[key];
          }
        }
      }
      animateTargetKeysRef.current = {};
      for (const key in targetValues) {
        animateTargetKeysRef.current[key] = true;
        animationTargetValues[key] = targetValues[key];
      }
      const targets = [
        animationTargetValues,
        interactionTarget,
        hoverTarget,
      ];
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

      let motionElement: Element | undefined;
      if (Object.keys(values).length > 0) {
        // `mainThreadDependencies` installs ElementCompt as the main-thread
        // Element constructor. Construct it here instead of capturing another
        // package worklet: Lynx for Web currently leaves nested/cross-module
        // worklet references as non-callable descriptors.
        const ElementConstructor = globalThis.Element as unknown as new(
          element: MainThread.Element,
        ) => Element;
        motionElement = new ElementConstructor(elementRef.current);
        styleCleanupRef.current = styleEffect(motionElement, values);
      }

      if (shouldAnimate) {
        for (const key in animationTargetValues) {
          const value = values[key];
          const targetValue = animationTargetValues[key];
          if (value && targetValue !== undefined) {
            void value.start(
              createMotionValueAnimation(
                key,
                value,
                targetValue as never,
                resolvedOptions as never,
              ),
            );
            if (value.animation) {
              animationRef.current.push(value.animation);
            }
          }
        }
      }

      const activeAnimations = [...animationRef.current];
      if (activeAnimations.length > 0 && animate !== undefined) {
        if (onAnimationStart) {
          void runOnBackground(onAnimationStart)(animate);
        }
        void Promise.all(activeAnimations).then(() => {
          if (animationGenerationRef.current !== animationGeneration) {
            return;
          }
          let addedValue = false;
          for (const key in transitionEnd) {
            const finalValue = transitionEnd[key];
            let value = values[key];
            if (!value && finalValue !== undefined) {
              value = motionValue(finalValue as string | number);
              generatedValuesRef.current[key] = value;
              values[key] = value;
              addedValue = true;
            } else if (value && finalValue !== undefined) {
              value.set(finalValue as never);
            }
          }
          if (addedValue && motionElement) {
            styleCleanupRef.current?.();
            styleCleanupRef.current = styleEffect(motionElement, values);
          }
          if (onAnimationComplete) {
            void runOnBackground(onAnimationComplete)(animate);
          }
        });
      }
    }

    void runOnMainThread(updateMotionStyles)(
      resolvedAnimate.target,
      resolvedTap.target,
      resolvedHover.target,
      resolvedAnimate.transitionEnd,
      workletAnimateTransition,
      initialValues,
      shouldAnimateTarget,
    );

    function stopMotionStyles() {
      'main thread';
      animationGenerationRef.current += 1;
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
    if (!resolvedTap.target) {
      return;
    }
    const isLynxForWeb = typeof SystemInfo !== 'undefined'
      && String(SystemInfo.platform) === 'web';
    tapActiveRef.current = true;
    for (const animation of animationRef.current) {
      animation.stop();
    }
    animationRef.current = [];
    for (const animation of tapAnimationRef.current) {
      animation.stop();
    }
    tapAnimationRef.current = [];
    const animateMotionTarget = animateValue as unknown as AnimateMotionTarget;
    const resolvedTransition = (workletTapTransition?.repeat === -1
      ? { ...workletTapTransition, repeat: Number.POSITIVE_INFINITY }
      : workletTapTransition) ?? {};
    if (isLynxForWeb || !event.currentTarget) {
      const targetValues = resolvedTap.target as Record<string, unknown>;
      for (const key in targetValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        const targetValue = targetValues[key];
        if (value && targetValue !== undefined) {
          void value.start(
            createMotionValueAnimation(
              key,
              value,
              targetValue as never,
              resolvedTransition as never,
            ),
          );
          if (value.animation) {
            tapAnimationRef.current.push(value.animation);
          }
        }
      }
      return;
    }
    const ElementConstructor = globalThis.Element as unknown as new(
      element: MainThread.Element,
    ) => Element;
    const element = new ElementConstructor(event.currentTarget);
    tapAnimationRef.current.push(
      animateMotionTarget(element, resolvedTap.target, resolvedTransition),
    );
  }

  function endTapAnimation(event: MainThread.TouchEvent) {
    'main thread';
    if (!resolvedTap.target) {
      return;
    }
    const isLynxForWeb = typeof SystemInfo !== 'undefined'
      && String(SystemInfo.platform) === 'web';
    tapActiveRef.current = false;
    for (const animation of tapAnimationRef.current) {
      animation.stop();
    }
    tapAnimationRef.current = [];
    const targetValues = resolvedTap.target as Record<string, unknown>;
    const restingTarget = hoverActiveRef.current && resolvedHover.target
      ? resolvedHover.target
      : resolvedAnimate.target;
    const animateValues = restingTarget as
      | Record<string, unknown>
      | undefined;
    const animateMotionTarget = animateValue as unknown as AnimateMotionTarget;
    const restingTransition = hoverActiveRef.current && resolvedHover.target
      ? workletHoverTransition
      : workletTapTransition;
    const resolvedTransition = (restingTransition?.repeat === -1
      ? { ...restingTransition, repeat: Number.POSITIVE_INFINITY }
      : restingTransition) ?? {};
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
    if (isLynxForWeb || !event.currentTarget) {
      for (const key in restingValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        if (value) {
          void value.start(
            createMotionValueAnimation(
              key,
              value,
              restingValues[key] as never,
              resolvedTransition as never,
            ),
          );
          if (value.animation) {
            tapAnimationRef.current.push(value.animation);
          }
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

  function startHoverAnimation() {
    'main thread';
    if (!resolvedHover.target || !elementRef.current) {
      return;
    }
    hoverActiveRef.current = true;
    if (tapActiveRef.current) {
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
    const resolvedTransition = (workletHoverTransition?.repeat === -1
      ? { ...workletHoverTransition, repeat: Number.POSITIVE_INFINITY }
      : workletHoverTransition) ?? {};
    const isLynxForWeb = typeof SystemInfo !== 'undefined'
      && String(SystemInfo.platform) === 'web';
    if (isLynxForWeb) {
      const targetValues = resolvedHover.target as Record<string, unknown>;
      for (const key in targetValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        const targetValue = targetValues[key];
        if (value && targetValue !== undefined) {
          void value.start(
            createMotionValueAnimation(
              key,
              value,
              targetValue as never,
              resolvedTransition as never,
            ),
          );
          if (value.animation) {
            tapAnimationRef.current.push(value.animation);
          }
        }
      }
      return;
    }
    const ElementConstructor = globalThis.Element as unknown as new(
      element: MainThread.Element,
    ) => Element;
    const element = new ElementConstructor(elementRef.current);
    tapAnimationRef.current.push(
      animateMotionTarget(
        element,
        resolvedHover.target,
        resolvedTransition,
      ),
    );
  }

  function endHoverAnimation() {
    'main thread';
    if (!resolvedHover.target || !elementRef.current) {
      return;
    }
    hoverActiveRef.current = false;
    if (tapActiveRef.current) {
      return;
    }
    for (const animation of tapAnimationRef.current) {
      animation.stop();
    }
    tapAnimationRef.current = [];
    const hoverValues = resolvedHover.target as Record<string, unknown>;
    const animateValues = resolvedAnimate.target as
      | Record<string, unknown>
      | undefined;
    const animateMotionTarget = animateValue as unknown as AnimateMotionTarget;
    const resolvedTransition = (workletHoverTransition?.repeat === -1
      ? { ...workletHoverTransition, repeat: Number.POSITIVE_INFINITY }
      : workletHoverTransition) ?? {};
    const restingValues: Record<string, unknown> = {};
    for (const key in hoverValues) {
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
      restingValues[key] = restingValue;
    }
    const isLynxForWeb = typeof SystemInfo !== 'undefined'
      && String(SystemInfo.platform) === 'web';
    if (isLynxForWeb) {
      for (const key in restingValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        if (value) {
          void value.start(
            createMotionValueAnimation(
              key,
              value,
              restingValues[key] as never,
              resolvedTransition as never,
            ),
          );
          if (value.animation) {
            tapAnimationRef.current.push(value.animation);
          }
        }
      }
      return;
    }
    const ElementConstructor = globalThis.Element as unknown as new(
      element: MainThread.Element,
    ) => Element;
    const element = new ElementConstructor(elementRef.current);
    tapAnimationRef.current.push(
      animateMotionTarget(element, restingValues, resolvedTransition),
    );
  }

  return {
    ...hostProps,
    style: initialStyle,
    'main-thread:ref': elementRef,
    ...(bindTouchStart ? { bindtouchstart: bindTouchStart } : {}),
    ...(bindTouchEnd ? { bindtouchend: bindTouchEnd } : {}),
    ...(bindTouchCancel ? { bindtouchcancel: bindTouchCancel } : {}),
    ...(bindLayoutChange ? { bindlayoutchange: bindLayoutChange } : {}),
    ...(bindGlobalMouseMove
      ? { 'global-bindmousemove': bindGlobalMouseMove }
      : {}),
    ...(resolvedTap.target
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
