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

import type {
  ComponentType,
  FunctionComponent,
  ReactNode,
} from '@lynx-js/react';
import {
  createContext,
  createElement,
  runOnBackground,
  runOnMainThread,
  useContext,
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
  MotionDefinition,
  MotionFactory,
  MotionImageProps,
  MotionProps,
  MotionTarget,
  MotionTextProps,
  MotionTransition,
  MotionViewProps,
} from './types.js';

interface MotionVariantContextValue {
  initial?: MotionDefinition | false;
  animate?: MotionDefinition;
  delay?: number;
}

const MotionVariantContext = createContext<MotionVariantContextValue>({});

function isVariantLabel(
  definition: MotionDefinition | false | undefined,
): definition is string | string[] {
  return typeof definition === 'string' || Array.isArray(definition);
}

function useInheritedMotionProps<Props extends MotionProps>(props: Props): {
  context: MotionVariantContextValue;
  delay: number;
  props: Props;
  resolvedAnimateDefinition: MotionTarget | false | undefined;
} {
  const parent = useContext(MotionVariantContext);
  const initial = props.initial === undefined && isVariantLabel(parent.initial)
    ? parent.initial
    : props.initial;
  const inheritsAnimate = props.animate === undefined
    && isVariantLabel(parent.animate);
  const animate = inheritsAnimate
    ? parent.animate
    : props.animate;
  const resolvedAnimateDefinition = resolveMotionDefinition(
    animate,
    props.variants,
    props.custom,
  );
  const resolvedAnimate = splitMotionTarget(
    resolvedAnimateDefinition,
    props.transition,
  );
  const inheritedDelay = inheritsAnimate ? parent.delay ?? 0 : 0;
  const delayChildren = resolvedAnimate.transition?.delayChildren;
  const childDelay = inheritedDelay
    + (typeof delayChildren === 'number' ? delayChildren : 0);
  const context = useMemo<MotionVariantContextValue>(() => ({
    ...(isVariantLabel(initial) ? { initial } : {}),
    ...(isVariantLabel(animate) ? { animate } : {}),
    ...(childDelay ? { delay: childDelay } : {}),
  }), [animate, childDelay, initial]);
  return {
    context,
    delay: inheritedDelay,
    props: initial === props.initial && animate === props.animate
      ? props
      : { ...props, initial, animate },
    resolvedAnimateDefinition,
  };
}

function shouldProvideVariantContext(
  props: MotionProps,
  context: MotionVariantContextValue,
  children: unknown,
): boolean {
  return children !== undefined
    && props.whileTap === undefined
    && props.whileHover === undefined
    && (isVariantLabel(context.initial) || isVariantLabel(context.animate));
}

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
  inheritedDelay = 0,
  inheritedResolvedAnimate?: MotionTarget | false,
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
  const interactionAnimationRef = useMainThreadRef<
    AnimationPlaybackControlsWithThen[]
  >([]);
  const hoverActiveRef = useMainThreadRef(false);
  const tapActiveRef = useMainThreadRef(false);
  const animationGenerationRef = useMainThreadRef(0);
  const interactionAnimationGenerationRef = useMainThreadRef(0);
  const interactionAnimationCompletionRef = useMainThreadRef<{
    generation: number;
    pending: number;
  }>({ generation: 0, pending: 0 });
  const interactionAnimationValueKeysRef = useMainThreadRef<
    Record<string, true>
  >({});
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
  const resolvedAnimateDefinition = inheritedResolvedAnimate
    ?? resolveMotionDefinition(animate, variants, custom);
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
  const resolvedInitialMotion = resolvedInitial === false
    ? undefined
    : splitMotionTarget(resolvedInitial, transition);
  const resolvedInitialTarget = resolvedInitial === false
    ? false
    : resolvedInitialMotion?.target;
  const resolvedAnimate = splitMotionTarget(
    resolvedAnimateDefinition,
    transition,
  );
  const resolvedTap = splitMotionTarget(resolvedTapDefinition, transition);
  const resolvedHover = splitMotionTarget(
    resolvedHoverDefinition,
    transition,
  );
  const initialFalseAnimateTarget = resolvedInitial === false
    ? {
      ...resolvedAnimate.target,
      ...resolvedAnimate.transitionEnd,
    }
    : resolvedAnimate.target;
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
        initialFalseAnimateTarget,
      ),
    [initialFalseAnimateTarget, resolvedInitialTarget, style],
  );
  const initialValues = useMemo(
    () =>
      resolveInitialValues(
        style,
        resolvedInitialTarget,
        initialFalseAnimateTarget,
      ),
    [initialFalseAnimateTarget, resolvedInitialTarget, style],
  );
  const workletAnimateTransition = useMemo(
    () =>
      inheritedDelay && resolvedAnimate.transition?.delay === undefined
        ? {
          ...resolvedAnimate.transition,
          delay: inheritedDelay,
          ...(resolvedAnimate.transition?.repeat === Number.POSITIVE_INFINITY
            ? { repeat: -1 }
            : {}),
        }
        : (resolvedAnimate.transition?.repeat === Number.POSITIVE_INFINITY
          ? { ...resolvedAnimate.transition, repeat: -1 }
          : resolvedAnimate.transition),
    [inheritedDelay, resolvedAnimate.transition],
  );
  const workletInitialTransition = useMemo(
    () =>
      resolvedInitialMotion?.transition?.repeat === Number.POSITIVE_INFINITY
        ? { ...resolvedInitialMotion.transition, repeat: -1 }
        : resolvedInitialMotion?.transition,
    [resolvedInitialMotion?.transition],
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
      for (const animation of interactionAnimationRef.current) {
        animation.stop();
      }
      interactionAnimationRef.current = [];
      for (const key in interactionAnimationValueKeysRef.current) {
        (generatedValuesRef.current[key] ?? motionValueBindings[key])?.stop();
      }
      interactionAnimationValueKeysRef.current = {};
      interactionAnimationGenerationRef.current += 1;
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
      const ownedTargetValues = {
        ...targetValues,
        ...transitionEnd,
      };
      const animationTargetValues: Record<string, unknown> = {};
      for (const key in animateTargetKeysRef.current) {
        if (!(key in ownedTargetValues)) {
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
      for (const key in ownedTargetValues) {
        animateTargetKeysRef.current[key] = true;
      }
      for (const key in targetValues) {
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

      function applyAnimateTransitionEnd() {
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
        if (addedValue && elementRef.current) {
          const ElementConstructor = globalThis.Element as unknown as new(
            element: MainThread.Element,
          ) => Element;
          motionElement ??= new ElementConstructor(elementRef.current);
          styleCleanupRef.current?.();
          styleCleanupRef.current = styleEffect(motionElement, values);
        }
      }

      const completionPromises: Promise<void>[] = [];
      if (shouldAnimate) {
        for (const key in animationTargetValues) {
          const value = values[key];
          const targetValue = animationTargetValues[key];
          if (value && targetValue !== undefined) {
            completionPromises.push(value.start(
              createMotionValueAnimation(
                key,
                value,
                targetValue as never,
                resolvedOptions as never,
              ),
            ));
            if (value.animation) {
              animationRef.current.push(value.animation);
            }
          }
        }
      }

      if (
        completionPromises.length > 0
        && animate !== undefined
        && onAnimationStart
      ) {
        void runOnBackground(onAnimationStart)(animate);
      }
      const hasTransitionEnd = Boolean(
        transitionEnd && Object.keys(transitionEnd).length > 0,
      );
      if (
        completionPromises.length === 0
        && animate !== undefined
        && hasTransitionEnd
      ) {
        if (shouldAnimate && onAnimationStart) {
          void runOnBackground(onAnimationStart)(animate);
        }
        const reportAnimationComplete = shouldAnimate && onAnimationComplete
          ? runOnBackground(onAnimationComplete)
          : undefined;
        if (reportAnimationComplete) {
          void reportAnimationComplete(animate);
        }
        requestAnimationFrame(() => {
          if (animationGenerationRef.current !== animationGeneration) {
            return;
          }
          applyAnimateTransitionEnd();
        });
      } else if (completionPromises.length > 0 && animate !== undefined) {
        void Promise.all(completionPromises).then(() => {
          if (animationGenerationRef.current !== animationGeneration) {
            return;
          }
          applyAnimateTransitionEnd();
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
      for (const animation of interactionAnimationRef.current) {
        animation.stop();
      }
      interactionAnimationRef.current = [];
      for (const key in interactionAnimationValueKeysRef.current) {
        (generatedValuesRef.current[key] ?? motionValueBindings[key])?.stop();
      }
      interactionAnimationValueKeysRef.current = {};
      interactionAnimationGenerationRef.current += 1;
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
    for (const animation of interactionAnimationRef.current) {
      animation.stop();
    }
    interactionAnimationRef.current = [];
    for (const key in interactionAnimationValueKeysRef.current) {
      (generatedValuesRef.current[key] ?? motionValues[key])?.stop();
    }
    interactionAnimationValueKeysRef.current = {};
    const animationGeneration = interactionAnimationGenerationRef.current + 1;
    interactionAnimationGenerationRef.current = animationGeneration;
    // Bind while the tap-start worklet is still executing on MTS; Motion calls
    // the returned dispatcher later from its animation scheduler.
    const reportAnimationComplete = onAnimationComplete
      ? runOnBackground(onAnimationComplete)
      : undefined;
    function applyTapTransitionEnd() {
      const transitionEnd = resolvedTap.transitionEnd;
      if (!transitionEnd) {
        return;
      }
      let addedValue = false;
      for (const key in transitionEnd) {
        const finalValue = transitionEnd[key];
        let value = generatedValuesRef.current[key] ?? motionValues[key];
        if (!value && finalValue !== undefined) {
          value = motionValue(finalValue as string | number);
          generatedValuesRef.current[key] = value;
          addedValue = true;
        } else if (value && finalValue !== undefined) {
          value.set(finalValue as never);
        }
      }
      if (addedValue && elementRef.current) {
        const ElementConstructor = globalThis.Element as unknown as new(
          element: MainThread.Element,
        ) => Element;
        styleCleanupRef.current?.();
        styleCleanupRef.current = styleEffect(
          new ElementConstructor(elementRef.current),
          { ...motionValues, ...generatedValuesRef.current },
        );
      }
    }
    const animateMotionTarget = animateValue as unknown as AnimateMotionTarget;
    let startedAnimationCount = 0;
    let completeTapWithoutAnimation: (() => void) | undefined;
    const resolvedTransition = (workletTapTransition?.repeat === -1
      ? { ...workletTapTransition, repeat: Number.POSITIVE_INFINITY }
      : workletTapTransition) ?? {};
    // Keep animation handles out of the MTS snapshot captured by a ReactLynx
    // rerender triggered from lifecycle callbacks.
    if (
      Object.keys(resolvedTap.target).length === 0
      && resolvedTap.transitionEnd
      && Object.keys(resolvedTap.transitionEnd).length > 0
    ) {
      startedAnimationCount = 1;
      completeTapWithoutAnimation = () => {
        if (reportAnimationComplete) {
          void reportAnimationComplete(whileTap!);
        }
        requestAnimationFrame(() => {
          if (
            interactionAnimationGenerationRef.current === animationGeneration
          ) {
            applyTapTransitionEnd();
          }
        });
      };
    } else if (isLynxForWeb || !event.currentTarget) {
      const targetValues = resolvedTap.target as Record<string, unknown>;
      let pendingAnimationCount = 0;
      function reportTapAnimationComplete(definition: MotionDefinition) {
        if (interactionAnimationGenerationRef.current !== animationGeneration) {
          return;
        }
        interactionAnimationCompletionRef.current.pending -= 1;
        if (
          interactionAnimationCompletionRef.current.generation
            === animationGeneration
          && interactionAnimationCompletionRef.current.pending === 0
        ) {
          applyTapTransitionEnd();
          if (reportAnimationComplete) {
            void reportAnimationComplete(definition);
          }
        }
      }
      for (const key in targetValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        if (value && targetValues[key] !== undefined) {
          pendingAnimationCount += 1;
        }
      }
      interactionAnimationCompletionRef.current = {
        generation: animationGeneration,
        pending: pendingAnimationCount,
      };
      startedAnimationCount = pendingAnimationCount;
      for (const key in targetValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        const targetValue = targetValues[key];
        if (value && targetValue !== undefined) {
          const startAnimation = createMotionValueAnimation(
            key,
            value,
            targetValue as never,
            resolvedTransition as never,
          );
          void value.start(complete =>
            startAnimation(() => {
              complete();
              reportTapAnimationComplete(whileTap!);
            })
          );
          if (value.animation) {
            Object.defineProperty(value, 'animation', { enumerable: false });
          }
          if (isLynxForWeb) {
            interactionAnimationValueKeysRef.current[key] = true;
          } else if (value.animation) {
            interactionAnimationRef.current.push(value.animation);
          }
        }
      }
    } else {
      const ElementConstructor = globalThis.Element as unknown as new(
        element: MainThread.Element,
      ) => Element;
      const element = new ElementConstructor(event.currentTarget);
      const animation = animateMotionTarget(
        element,
        resolvedTap.target,
        {
          ...resolvedTransition,
          onComplete: () => {
            if (
              interactionAnimationGenerationRef.current === animationGeneration
            ) {
              applyTapTransitionEnd();
              if (reportAnimationComplete) {
                void reportAnimationComplete(whileTap!);
              }
            }
          },
        },
      );
      interactionAnimationRef.current.push(animation);
      startedAnimationCount = 1;
    }
    if (startedAnimationCount > 0 && onAnimationStart) {
      void runOnBackground(onAnimationStart)(whileTap!);
    }
    if (completeTapWithoutAnimation) {
      completeTapWithoutAnimation();
    }
  }

  function endTapAnimation(event: MainThread.TouchEvent) {
    'main thread';
    if (!resolvedTap.target) {
      return;
    }
    const isLynxForWeb = typeof SystemInfo !== 'undefined'
      && String(SystemInfo.platform) === 'web';
    tapActiveRef.current = false;
    for (const animation of interactionAnimationRef.current) {
      animation.stop();
    }
    interactionAnimationRef.current = [];
    for (const key in interactionAnimationValueKeysRef.current) {
      (generatedValuesRef.current[key] ?? motionValues[key])?.stop();
    }
    interactionAnimationValueKeysRef.current = {};
    const animationGeneration = interactionAnimationGenerationRef.current + 1;
    interactionAnimationGenerationRef.current = animationGeneration;
    // Bind while the tap-end worklet is still executing on MTS; restoration
    // completion arrives later from Motion's animation scheduler.
    const reportAnimationComplete = onAnimationComplete
      ? runOnBackground(onAnimationComplete)
      : undefined;
    const targetValues = {
      ...resolvedTap.target,
      ...resolvedTap.transitionEnd,
    } as Record<string, unknown>;
    const restingTarget = hoverActiveRef.current && resolvedHover.target
      ? resolvedHover.target
      : resolvedAnimate.target;
    const animateValues = restingTarget as
      | Record<string, unknown>
      | undefined;
    const animateMotionTarget = animateValue as unknown as AnimateMotionTarget;
    let startedAnimationCount = 0;
    const restingTransition = hoverActiveRef.current && resolvedHover.target
      ? workletHoverTransition
      : (resolvedAnimate.target
        ? workletAnimateTransition
        : workletInitialTransition);
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
    const restingDefinition: MotionDefinition = hoverActiveRef.current
        && whileHover !== undefined
      ? whileHover
      : animate ?? (restingValues as MotionTarget);
    if (isLynxForWeb || !event.currentTarget) {
      let pendingAnimationCount = 0;
      function reportTapAnimationComplete() {
        if (interactionAnimationGenerationRef.current !== animationGeneration) {
          return;
        }
        interactionAnimationCompletionRef.current.pending -= 1;
        if (
          interactionAnimationCompletionRef.current.generation
            === animationGeneration
          && interactionAnimationCompletionRef.current.pending === 0
          && reportAnimationComplete
        ) {
          void reportAnimationComplete(restingDefinition);
        }
      }
      for (const key in restingValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        if (value) {
          pendingAnimationCount += 1;
        }
      }
      interactionAnimationCompletionRef.current = {
        generation: animationGeneration,
        pending: pendingAnimationCount,
      };
      startedAnimationCount = pendingAnimationCount;
      for (const key in restingValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        if (value) {
          const startAnimation = createMotionValueAnimation(
            key,
            value,
            restingValues[key] as never,
            resolvedTransition as never,
          );
          void value.start(complete =>
            startAnimation(() => {
              complete();
              reportTapAnimationComplete();
            })
          );
          if (value.animation) {
            Object.defineProperty(value, 'animation', { enumerable: false });
          }
          if (isLynxForWeb) {
            interactionAnimationValueKeysRef.current[key] = true;
          } else if (value.animation) {
            interactionAnimationRef.current.push(value.animation);
          }
        }
      }
    } else {
      const ElementConstructor = globalThis.Element as unknown as new(
        element: MainThread.Element,
      ) => Element;
      const element = new ElementConstructor(event.currentTarget);
      const animation = animateMotionTarget(
        element,
        restingValues,
        {
          ...resolvedTransition,
          onComplete: () => {
            if (
              interactionAnimationGenerationRef.current === animationGeneration
              && reportAnimationComplete
            ) {
              void reportAnimationComplete(restingDefinition);
            }
          },
        },
      );
      interactionAnimationRef.current.push(animation);
      startedAnimationCount = 1;
    }
    if (startedAnimationCount > 0 && onAnimationStart) {
      void runOnBackground(onAnimationStart)(restingDefinition);
    }
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
    const animationGeneration = interactionAnimationGenerationRef.current + 1;
    interactionAnimationGenerationRef.current = animationGeneration;
    for (const animation of animationRef.current) {
      animation.stop();
    }
    animationRef.current = [];
    for (const animation of interactionAnimationRef.current) {
      animation.stop();
    }
    interactionAnimationRef.current = [];
    for (const key in interactionAnimationValueKeysRef.current) {
      (generatedValuesRef.current[key] ?? motionValues[key])?.stop();
    }
    interactionAnimationValueKeysRef.current = {};
    const reportAnimationComplete = onAnimationComplete
      ? runOnBackground(onAnimationComplete)
      : undefined;
    function applyHoverTransitionEnd() {
      const transitionEnd = resolvedHover.transitionEnd;
      if (!transitionEnd) {
        return;
      }
      let addedValue = false;
      for (const key in transitionEnd) {
        const finalValue = transitionEnd[key];
        let value = generatedValuesRef.current[key] ?? motionValues[key];
        if (!value && finalValue !== undefined) {
          value = motionValue(finalValue as string | number);
          generatedValuesRef.current[key] = value;
          addedValue = true;
        } else if (value && finalValue !== undefined) {
          value.set(finalValue as never);
        }
      }
      if (addedValue && elementRef.current) {
        const ElementConstructor = globalThis.Element as unknown as new(
          element: MainThread.Element,
        ) => Element;
        styleCleanupRef.current?.();
        styleCleanupRef.current = styleEffect(
          new ElementConstructor(elementRef.current),
          { ...motionValues, ...generatedValuesRef.current },
        );
      }
    }
    const animateMotionTarget = animateValue as unknown as AnimateMotionTarget;
    let startedAnimationCount = 0;
    let completeHoverWithoutAnimation: (() => void) | undefined;
    const resolvedTransition = (workletHoverTransition?.repeat === -1
      ? { ...workletHoverTransition, repeat: Number.POSITIVE_INFINITY }
      : workletHoverTransition) ?? {};
    const isLynxForWeb = typeof SystemInfo !== 'undefined'
      && String(SystemInfo.platform) === 'web';
    if (
      Object.keys(resolvedHover.target).length === 0
      && resolvedHover.transitionEnd
      && Object.keys(resolvedHover.transitionEnd).length > 0
    ) {
      startedAnimationCount = 1;
      completeHoverWithoutAnimation = () => {
        if (reportAnimationComplete) {
          void reportAnimationComplete(whileHover!);
        }
        requestAnimationFrame(() => {
          if (
            interactionAnimationGenerationRef.current === animationGeneration
          ) {
            applyHoverTransitionEnd();
          }
        });
      };
    } else if (isLynxForWeb) {
      const targetValues = resolvedHover.target as Record<string, unknown>;
      let pendingAnimationCount = 0;
      function reportHoverAnimationComplete() {
        if (
          interactionAnimationGenerationRef.current !== animationGeneration
        ) {
          return;
        }
        interactionAnimationCompletionRef.current.pending -= 1;
        if (
          interactionAnimationCompletionRef.current.generation
            === animationGeneration
          && interactionAnimationCompletionRef.current.pending === 0
        ) {
          applyHoverTransitionEnd();
          if (reportAnimationComplete) {
            void reportAnimationComplete(whileHover!);
          }
        }
      }
      for (const key in targetValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        if (value && targetValues[key] !== undefined) {
          pendingAnimationCount += 1;
        }
      }
      interactionAnimationCompletionRef.current = {
        generation: animationGeneration,
        pending: pendingAnimationCount,
      };
      startedAnimationCount = pendingAnimationCount;
      for (const key in targetValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        const targetValue = targetValues[key];
        if (value && targetValue !== undefined) {
          const startAnimation = createMotionValueAnimation(
            key,
            value,
            targetValue as never,
            resolvedTransition as never,
          );
          void value.start(complete =>
            startAnimation(() => {
              complete();
              reportHoverAnimationComplete();
            })
          );
          if (value.animation) {
            Object.defineProperty(value, 'animation', { enumerable: false });
          }
          interactionAnimationValueKeysRef.current[key] = true;
        }
      }
    } else {
      const ElementConstructor = globalThis.Element as unknown as new(
        element: MainThread.Element,
      ) => Element;
      const element = new ElementConstructor(elementRef.current);
      interactionAnimationRef.current.push(animateMotionTarget(
        element,
        resolvedHover.target,
        {
          ...resolvedTransition,
          onComplete: () => {
            if (
              interactionAnimationGenerationRef.current === animationGeneration
            ) {
              applyHoverTransitionEnd();
              if (reportAnimationComplete) {
                void reportAnimationComplete(whileHover!);
              }
            }
          },
        },
      ));
      startedAnimationCount = 1;
    }
    if (startedAnimationCount > 0 && onAnimationStart) {
      void runOnBackground(onAnimationStart)(whileHover!);
    }
    if (completeHoverWithoutAnimation) {
      completeHoverWithoutAnimation();
    }
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
    const animationGeneration = interactionAnimationGenerationRef.current + 1;
    interactionAnimationGenerationRef.current = animationGeneration;
    for (const animation of interactionAnimationRef.current) {
      animation.stop();
    }
    interactionAnimationRef.current = [];
    for (const key in interactionAnimationValueKeysRef.current) {
      (generatedValuesRef.current[key] ?? motionValues[key])?.stop();
    }
    interactionAnimationValueKeysRef.current = {};
    const reportAnimationComplete = onAnimationComplete
      ? runOnBackground(onAnimationComplete)
      : undefined;
    const hoverValues = {
      ...resolvedHover.target,
      ...resolvedHover.transitionEnd,
    } as Record<string, unknown>;
    const animateValues = resolvedAnimate.target as
      | Record<string, unknown>
      | undefined;
    const animateMotionTarget = animateValue as unknown as AnimateMotionTarget;
    let startedAnimationCount = 0;
    const restingTransition = resolvedAnimate.target
      ? workletAnimateTransition
      : workletInitialTransition;
    const resolvedTransition = (restingTransition?.repeat === -1
      ? { ...restingTransition, repeat: Number.POSITIVE_INFINITY }
      : restingTransition) ?? {};
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
    const restingDefinition: MotionDefinition = animate
      ?? (restingValues as MotionTarget);
    if (isLynxForWeb) {
      let pendingAnimationCount = 0;
      function reportHoverAnimationComplete() {
        if (
          interactionAnimationGenerationRef.current !== animationGeneration
        ) {
          return;
        }
        interactionAnimationCompletionRef.current.pending -= 1;
        if (
          interactionAnimationCompletionRef.current.generation
            === animationGeneration
          && interactionAnimationCompletionRef.current.pending === 0
          && reportAnimationComplete
        ) {
          void reportAnimationComplete(restingDefinition);
        }
      }
      for (const key in restingValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        if (value) {
          pendingAnimationCount += 1;
        }
      }
      interactionAnimationCompletionRef.current = {
        generation: animationGeneration,
        pending: pendingAnimationCount,
      };
      startedAnimationCount = pendingAnimationCount;
      for (const key in restingValues) {
        const value = generatedValuesRef.current[key] ?? motionValues[key];
        if (value) {
          const startAnimation = createMotionValueAnimation(
            key,
            value,
            restingValues[key] as never,
            resolvedTransition as never,
          );
          void value.start(complete =>
            startAnimation(() => {
              complete();
              reportHoverAnimationComplete();
            })
          );
          if (value.animation) {
            Object.defineProperty(value, 'animation', { enumerable: false });
          }
          interactionAnimationValueKeysRef.current[key] = true;
        }
      }
    } else {
      const ElementConstructor = globalThis.Element as unknown as new(
        element: MainThread.Element,
      ) => Element;
      const element = new ElementConstructor(elementRef.current);
      interactionAnimationRef.current.push(animateMotionTarget(
        element,
        restingValues,
        {
          ...resolvedTransition,
          onComplete: () => {
            if (
              interactionAnimationGenerationRef.current === animationGeneration
              && reportAnimationComplete
            ) {
              void reportAnimationComplete(restingDefinition);
            }
          },
        },
      ));
      startedAnimationCount = 1;
    }
    if (startedAnimationCount > 0 && onAnimationStart) {
      void runOnBackground(onAnimationStart)(restingDefinition);
    }
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
  const inherited = useInheritedMotionProps(props);
  const hostProps = useMotionHostProps(
    inherited.props,
    inherited.delay,
    inherited.resolvedAnimateDefinition,
  );
  const { children, ...elementProps } = hostProps;
  if (!shouldProvideVariantContext(props, inherited.context, children)) {
    return createElement('view', hostProps as IntrinsicElements['view']);
  }
  return createElement(
    'view',
    elementProps as IntrinsicElements['view'],
    createElement(MotionVariantContext.Provider, {
      value: inherited.context,
      children: children as ReactNode,
    }),
  );
};

const MotionText: FunctionComponent<MotionTextProps> = (props) => {
  const inherited = useInheritedMotionProps(props);
  const hostProps = useMotionHostProps(
    inherited.props,
    inherited.delay,
    inherited.resolvedAnimateDefinition,
  );
  const { children, ...elementProps } = hostProps;
  if (!shouldProvideVariantContext(props, inherited.context, children)) {
    return createElement('text', hostProps as IntrinsicElements['text']);
  }
  return createElement(
    'text',
    elementProps as IntrinsicElements['text'],
    createElement(MotionVariantContext.Provider, {
      value: inherited.context,
      children: children as ReactNode,
    }),
  );
};

const MotionImage: FunctionComponent<MotionImageProps> = (props) => {
  const inherited = useInheritedMotionProps(props);
  const hostProps = useMotionHostProps(
    inherited.props,
    inherited.delay,
    inherited.resolvedAnimateDefinition,
  );
  const { children, ...elementProps } = hostProps;
  if (!shouldProvideVariantContext(props, inherited.context, children)) {
    return createElement('image', hostProps as IntrinsicElements['image']);
  }
  return createElement(
    'image',
    elementProps as IntrinsicElements['image'],
    createElement(MotionVariantContext.Provider, {
      value: inherited.context,
      children: children as ReactNode,
    }),
  );
};

function createMotionComponent<Props extends { style?: unknown }>(
  Component: ComponentType<Props>,
): FunctionComponent<MotionComponentProps<Props>> {
  const MotionComponent: FunctionComponent<MotionComponentProps<Props>> = (
    props,
  ) => {
    const inherited = useInheritedMotionProps(props);
    const hostProps = useMotionHostProps(
      inherited.props,
      inherited.delay,
      inherited.resolvedAnimateDefinition,
    );
    const { children, ...componentProps } = hostProps;
    if (!shouldProvideVariantContext(props, inherited.context, children)) {
      return createElement(Component, hostProps as unknown as Props);
    }
    return createElement(
      Component,
      componentProps as unknown as Props,
      createElement(MotionVariantContext.Provider, {
        value: inherited.context,
        children: children as ReactNode,
      }),
    );
  };
  return MotionComponent;
}

export const motion: MotionFactory = {
  view: MotionView,
  text: MotionText,
  image: MotionImage,
  create: createMotionComponent,
};
