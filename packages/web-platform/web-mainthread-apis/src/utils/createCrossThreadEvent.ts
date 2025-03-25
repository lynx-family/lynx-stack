// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Cloneable, LynxCrossThreadEvent } from '@lynx-js/web-constants';
import {
  elementToRuntimeInfoMap,
  type MainThreadRuntime,
} from '../MainThreadRuntime.js';

export function createCrossThreadEvent(
  runtime: MainThreadRuntime,
  domEvent: Event,
): LynxCrossThreadEvent {
  const targetElement = domEvent.target as HTMLElement;
  const currentTargetElement = domEvent
    .currentTarget! as HTMLElement;
  const type = domEvent.type;
  const params: Cloneable = {};
  if (type.match(/^transition/)) {
    Object.assign(params, {
      'animation_type': 'keyframe-animation',
      'animation_name': (domEvent as TransitionEvent).propertyName,
      new_animator: true, // we support the new_animator only
    });
  } else if (type.match(/animation/)) {
    Object.assign(params, {
      'animation_type': 'keyframe-animation',
      'animation_name': (domEvent as AnimationEvent).animationName,
      new_animator: true, // we support the new_animator only
    });
  }
  const targetElementRuntimeInfo = runtime[elementToRuntimeInfoMap].get(
    targetElement,
  )!;
  const currentTargetElementRuntimeInfo = runtime[elementToRuntimeInfoMap].get(
    targetElement,
  )!;
  return {
    type,
    timestamp: domEvent.timeStamp,
    target: {
      id: targetElement.id,
      dataset: targetElementRuntimeInfo.lynxDataset,
      uniqueId: targetElementRuntimeInfo.uniqueId,
    },
    currentTarget: {
      id: currentTargetElement.id,
      dataset: currentTargetElementRuntimeInfo.lynxDataset,
      uniqueId: currentTargetElementRuntimeInfo.uniqueId,
    },
    // @ts-expect-error
    detail: domEvent.detail ?? {},
    params,
  };
}
