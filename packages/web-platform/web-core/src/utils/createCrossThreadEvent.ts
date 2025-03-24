// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  lynxRuntimeValue,
  lynxUniqueIdAttribute,
  W3cEventNameToLynx,
  type Cloneable,
  type LynxCrossThreadEvent,
} from '@lynx-js/web-constants';
import type { RuntimePropertyOnElement } from '../types/RuntimePropertyOnElement';

export function createCrossThreadEvent(domEvent: Event): LynxCrossThreadEvent {
  const targetElement = domEvent.target as (RuntimePropertyOnElement & Element);
  const currentTargetElement = domEvent
    .currentTarget! as (RuntimePropertyOnElement & Element);
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
  return {
    type: W3cEventNameToLynx[type] ?? type,
    timestamp: domEvent.timeStamp,
    target: {
      id: targetElement.id,
      dataset: targetElement[lynxRuntimeValue].dataset,
      uniqueId: parseFloat(targetElement.getAttribute(lynxUniqueIdAttribute)!),
    },
    currentTarget: {
      id: currentTargetElement.id,
      dataset: currentTargetElement[lynxRuntimeValue]?.dataset ?? {},
      uniqueId: parseFloat(
        currentTargetElement.getAttribute?.(lynxUniqueIdAttribute)!,
      ),
    },
    // @ts-expect-error
    detail: domEvent.detail ?? {},
    params,
  };
}
