// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  type Cloneable,
  type CloneableObject,
  type LynxCrossThreadEvent,
  type MinimalRawEventObject,
  W3cEventNameToLynx,
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
): LynxCrossThreadEvent {
  const type = domEvent.type;
  const params: Cloneable = {};
  const isTrusted = domEvent.isTrusted;
  const otherProperties: CloneableObject = {};
  let detail = domEvent.detail ?? {};
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
  } else if (type.startsWith('mouse')) {
    const mouseEvent = domEvent as MouseEvent;
    Object.assign(otherProperties, {
      button: mouseEvent.button,
      buttons: mouseEvent.buttons,
      x: mouseEvent.x,
      y: mouseEvent.y,
      pageX: mouseEvent.pageX,
      pageY: mouseEvent.pageY,
      clientX: mouseEvent.clientX,
      clientY: mouseEvent.clientY,
    });
  } else if (type === 'click') {
    detail = {
      x: (domEvent as MouseEvent).x,
      y: (domEvent as MouseEvent).y,
    };
  }

  const lynxEventName = W3cEventNameToLynx[domEvent.type] ?? domEvent.type;

  return {
    type: lynxEventName,
    timestamp: domEvent.timeStamp,
    // @ts-expect-error
    detail,
    params,
    ...otherProperties,
  };
}
