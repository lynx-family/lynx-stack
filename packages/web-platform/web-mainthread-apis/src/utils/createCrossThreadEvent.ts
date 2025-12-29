// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  lynxDatasetAttribute,
  lynxUniqueIdAttribute,
  type Cloneable,
  type CloneableObject,
  type LynxCrossThreadEvent,
  type MinimalRawEventObject,
} from '@lynx-js/web-constants';

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
  domEvent: MinimalRawEventObject,
  eventName: string,
): LynxCrossThreadEvent {
  const targetElement = domEvent.target as HTMLElement;
  const currentTargetElement = (domEvent
      .currentTarget as HTMLElement).getAttribute
    ? (domEvent.currentTarget as HTMLElement)
    : undefined;
  const type = domEvent.type;
  const params: Cloneable = {};
  const isTrusted = domEvent.isTrusted;
  const otherProperties: CloneableObject = {};
  if (type.match(/^transition/)) {
    Object.assign(params, {
      'animation_type': 'keyframe-animation',
      'animation_name': domEvent.propertyName,
      new_animator: true, // we support the new_animator only
    });
  } else if (type.match(/animation/)) {
    Object.assign(params, {
      'animation_type': 'keyframe-animation',
      'animation_name': domEvent.animationName,
      new_animator: true, // we support the new_animator only
    });
  } else if (type.startsWith('touch')) {
    const touchEvent = domEvent;
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
  const currentTargetDatasetString = currentTargetElement?.getAttribute(
    lynxDatasetAttribute,
  );
  const currentTargetDataset = currentTargetDatasetString
    ? JSON.parse(decodeURIComponent(currentTargetDatasetString))
    : {};
  const targetDatasetString = targetElement.getAttribute(lynxDatasetAttribute);
  const targetDataset = targetDatasetString
    ? JSON.parse(decodeURIComponent(targetDatasetString))
    : {};

  return {
    type: eventName,
    timestamp: domEvent.timeStamp,
    target: {
      id: targetElement.getAttribute('id'),
      dataset: targetDataset,
      uniqueId: Number(targetElement.getAttribute(lynxUniqueIdAttribute)),
    },
    currentTarget: currentTargetElement
      ? {
        id: currentTargetElement.getAttribute('id'),
        dataset: currentTargetDataset,
        uniqueId: Number(
          currentTargetElement.getAttribute(lynxUniqueIdAttribute),
        ),
      }
      : null,
    // @ts-expect-error
    detail: domEvent.detail ?? {},
    params,
    ...otherProperties,
  };
}
