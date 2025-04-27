// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  Cloneable,
  CloneableObject,
  LynxCrossThreadEvent,
} from '@lynx-js/web-constants';
import {
  elementToRuntimeInfoMap,
  type MainThreadRuntime,
} from '../MainThreadRuntime.js';

function toCloneableObject(obj: any): CloneableObject {
  const cloneableObj: CloneableObject = {};
  for (const key in obj) {
    const value = obj[key];
    if (
      typeof value === 'boolean' || typeof value === 'number'
      || typeof value === 'string' || value === null
    ) {
      cloneableObj[key] = value;
    }
  }
  return cloneableObj;
}

export function createCrossThreadEvent(
  runtime: MainThreadRuntime,
  domEvent: Event,
  eventName: string,
): LynxCrossThreadEvent {
  const targetElement = domEvent.target as HTMLElement;
  const currentTargetElement = domEvent
    .currentTarget! as HTMLElement;
  const type = domEvent.type;
  const params: Cloneable = {};
  const isTrusted = domEvent.isTrusted;
  const otherProperties: CloneableObject = {};
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
  } else if (type.startsWith('touch')) {
    const touchEvent = domEvent as TouchEvent;
    const touch = [...touchEvent.touches as unknown as Touch[]];
    const targetTouches = [...touchEvent.targetTouches as unknown as Touch[]];
    const changedTouches = [...touchEvent.changedTouches as unknown as Touch[]];
    Object.assign(otherProperties, {
      touches: isTrusted ? touch.map(toCloneableObject) : touch,
      targetTouches: isTrusted
        ? targetTouches.map(
          toCloneableObject,
        )
        : targetTouches,
      changedTouches: isTrusted
        ? changedTouches.map(
          toCloneableObject,
        )
        : changedTouches,
    });
  }
  const targetElementRuntimeInfo = runtime[elementToRuntimeInfoMap].get(
    targetElement,
  )!;
  const currentTargetElementRuntimeInfo = runtime[elementToRuntimeInfoMap].get(
    currentTargetElement,
  );
  return {
    type: eventName,
    timestamp: domEvent.timeStamp,
    target: {
      id: targetElement.id,
      dataset: targetElementRuntimeInfo.lynxDataset,
      uniqueId: targetElementRuntimeInfo.uniqueId,
    },
    currentTarget: currentTargetElementRuntimeInfo
      ? {
        id: currentTargetElement.id,
        dataset: currentTargetElementRuntimeInfo.lynxDataset,
        uniqueId: currentTargetElementRuntimeInfo.uniqueId,
      }
      : null,
    // @ts-expect-error
    detail: domEvent.detail ?? {},
    params,
    ...otherProperties,
  };
}
