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
  TransformTemplate,
} from 'motion-dom';
import {
  buildTransform,
  getValueTransition,
  motionValue,
  styleEffect,
  transformProps,
  transformValue,
} from 'motion-dom' with {
  runtime: 'shared',
};

import type { ComponentType, FunctionComponent } from '@lynx-js/react';
import {
  createElement,
  runOnBackground,
  runOnMainThread,
  useEffect,
  useMainThreadEvent,
  useMainThreadEvents,
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
    transformTemplate,
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
  const hoverLayoutRef = useRef<
    { left: number; right: number; top: number; bottom: number } | null
  >(null);
  const hoverActiveBackgroundRef = useRef(false);
  const generatedValuesRef = useMainThreadRef<
    Record<string, MotionValue<string | number>>
  >({});
  const styleCleanupRef = useMainThreadRef<(() => void) | null>(null);
  const transformRefreshRef = useMainThreadRef<(() => void) | null>(null);

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
  const styleKey = motionDefinitionKey(style);
  const initialStyle = useMemo(
    () => resolveInitialStyle(style, resolvedInitialTarget),
    [resolvedInitialTarget, style],
  );
  const initialValues = useMemo(
    () => resolveInitialValues(style, resolvedInitialTarget),
    [resolvedInitialTarget, style],
  );
  const workletAnimateTransition = useMainThreadEvents(useMemo(
    () =>
      resolvedAnimate.transition?.repeat === Number.POSITIVE_INFINITY
        ? { ...resolvedAnimate.transition, repeat: -1 }
        : resolvedAnimate.transition,
    [resolvedAnimate.transition],
  ));
  const workletTapTransition = useMainThreadEvents(useMemo(
    () =>
      resolvedTap.transition?.repeat === Number.POSITIVE_INFINITY
        ? { ...resolvedTap.transition, repeat: -1 }
        : resolvedTap.transition,
    [resolvedTap.transition],
  ));
  const workletHoverTransition = useMainThreadEvents(useMemo(
    () =>
      resolvedHover.transition?.repeat === Number.POSITIVE_INFINITY
        ? { ...resolvedHover.transition, repeat: -1 }
        : resolvedHover.transition,
    [resolvedHover.transition],
  ));
  const transformTemplateCallable = useMainThreadEvent(transformTemplate);
  const hasTransformTemplate = transformTemplateCallable !== null;
  const animationKey = motionDefinitionKey({
    animate: {
      target: resolvedAnimate.target,
      transition: workletAnimateTransition,
    },
    whileTap: {
      target: resolvedTap.target,
      transition: workletTapTransition,
    },
    whileHover: {
      target: resolvedHover.target,
      transition: workletHoverTransition,
    },
  });
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
    if (
      !resolvedAnimate.target
      && !resolvedTap.target
      && !resolvedHover.target
      && Object.keys(motionValues).length === 0
      && !hasTransformTemplate
    ) {
      return;
    }
    const motionValueBindings = { ...motionValues };

    function updateMotionStyles(
      target: MotionTarget | undefined,
      interactionTarget: MotionTarget | undefined,
      hoverTarget: MotionTarget | undefined,
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
      const animationGeneration = animationGenerationRef.current + 1;
      animationGenerationRef.current = animationGeneration;
      styleCleanupRef.current?.();
      styleCleanupRef.current = null;
      transformRefreshRef.current = null;

      if (!elementRef.current) {
        return;
      }

      const animateMotionValue = animateValue as unknown as AnimateMotionTarget;
      const resolvedOptions = options?.repeat === -1
        ? { ...options, repeat: Number.POSITIVE_INFINITY }
        : options;
      const values = { ...motionValueBindings };
      const targets = [target, interactionTarget, hoverTarget];
      if (transformTemplateCallable) {
        for (const key in startingValues) {
          if (values[key] || !transformProps.has(key)) {
            continue;
          }
          const initialTransformValue = startingValues[key];
          if (
            typeof initialTransformValue !== 'string'
            && typeof initialTransformValue !== 'number'
          ) {
            continue;
          }
          let value = generatedValuesRef.current[key];
          if (!value) {
            value = motionValue(initialTransformValue);
            generatedValuesRef.current[key] = value;
          } else if (
            !targets.some(definition =>
              definition !== undefined && key in definition
            )
          ) {
            value.set(initialTransformValue);
          }
          values[key] = value;
        }
      }
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

      if (Object.keys(values).length > 0 || transformTemplateCallable) {
        const ElementConstructor = globalThis.Element as unknown as new(
          element: MainThread.Element,
        ) => Element;
        const element = new ElementConstructor(elementRef.current);
        if (transformTemplateCallable && !values['transform']) {
          const styleValues: Record<string, MotionValue> = { ...values };
          for (const key in styleValues) {
            if (transformProps.has(key)) {
              delete styleValues[key];
            }
          }
          const readTemplatedTransform = () => {
            const latest: Record<string, string | number> = {};
            for (const key in values) {
              if (transformProps.has(key)) {
                latest[key] = values[key]!.get();
              }
            }
            return buildTransform(
              latest,
              {},
              transformTemplateCallable as unknown as TransformTemplate,
            );
          };
          const templatedTransform = transformValue(readTemplatedTransform);
          const refreshTransform = () => {
            templatedTransform.set(readTemplatedTransform());
          };
          transformRefreshRef.current = refreshTransform;
          styleValues['transform'] = templatedTransform;
          const stopStyleEffect = styleEffect(element, styleValues);
          styleCleanupRef.current = () => {
            if (transformRefreshRef.current === refreshTransform) {
              transformRefreshRef.current = null;
            }
            stopStyleEffect();
            templatedTransform.destroy();
          };
        } else {
          styleCleanupRef.current = styleEffect(element, values);
        }
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
                getValueTransition(resolvedOptions, key) as
                  | MotionTransition
                  | undefined,
              ),
            );
          }
        }
      }

      const activeAnimations = [...animationRef.current];
      if (activeAnimations.length > 0 && animate !== undefined) {
        if (onAnimationStart) {
          void runOnBackground(onAnimationStart)(animate);
        }
        void Promise.all(activeAnimations).then(() => {
          if (
            animationGenerationRef.current === animationGeneration
            && onAnimationComplete
          ) {
            void runOnBackground(onAnimationComplete)(animate);
          }
        });
      }
    }

    void runOnMainThread(updateMotionStyles)(
      resolvedAnimate.target,
      resolvedTap.target,
      resolvedHover.target,
      workletAnimateTransition,
      initialValues,
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
      transformRefreshRef.current = null;
    }

    return () => {
      void runOnMainThread(stopMotionStyles)();
    };
  }, [animationKey, hasTransformTemplate, styleKey]);

  useEffect(() => {
    if (!transformTemplateCallable) {
      return;
    }
    function refreshTransformTemplate() {
      'main thread';
      transformRefreshRef.current?.();
    }
    void runOnMainThread(refreshTransformTemplate)();
  }, [transformTemplate, transformTemplateCallable]);

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
    const resolvedTransition = workletTapTransition?.repeat === -1
      ? { ...workletTapTransition, repeat: Number.POSITIVE_INFINITY }
      : workletTapTransition;
    if (isLynxForWeb || !event.currentTarget) {
      const targetValues = resolvedTap.target as Record<string, unknown>;
      for (const key in targetValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        const targetValue = targetValues[key];
        if (value && targetValue !== undefined) {
          tapAnimationRef.current.push(
            animateMotionTarget(
              value,
              targetValue,
              getValueTransition(resolvedTransition, key) as
                | MotionTransition
                | undefined,
            ),
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
    const resolvedTransition = restingTransition?.repeat === -1
      ? { ...restingTransition, repeat: Number.POSITIVE_INFINITY }
      : restingTransition;
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
          tapAnimationRef.current.push(
            animateMotionTarget(
              value,
              restingValues[key],
              getValueTransition(resolvedTransition, key) as
                | MotionTransition
                | undefined,
            ),
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
    const resolvedTransition = workletHoverTransition?.repeat === -1
      ? { ...workletHoverTransition, repeat: Number.POSITIVE_INFINITY }
      : workletHoverTransition;
    const isLynxForWeb = typeof SystemInfo !== 'undefined'
      && String(SystemInfo.platform) === 'web';
    if (isLynxForWeb) {
      const targetValues = resolvedHover.target as Record<string, unknown>;
      for (const key in targetValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        const targetValue = targetValues[key];
        if (value && targetValue !== undefined) {
          tapAnimationRef.current.push(
            animateMotionTarget(
              value,
              targetValue,
              getValueTransition(resolvedTransition, key) as
                | MotionTransition
                | undefined,
            ),
          );
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
    const resolvedTransition = workletHoverTransition?.repeat === -1
      ? { ...workletHoverTransition, repeat: Number.POSITIVE_INFINITY }
      : workletHoverTransition;
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
          tapAnimationRef.current.push(
            animateMotionTarget(
              value,
              restingValues[key],
              getValueTransition(resolvedTransition, key) as
                | MotionTransition
                | undefined,
            ),
          );
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
  div: MotionView,
  view: MotionView,
  text: MotionText,
  image: MotionImage,
  create: createMotionComponent,
};
