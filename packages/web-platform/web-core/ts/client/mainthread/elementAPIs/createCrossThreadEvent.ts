// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  Cloneable,
  CloneableObject,
  LynxCrossThreadEvent,
  MinimalRawEventObject,
} from '../../../types/index.js';
import { W3cEventNameToLynx } from '../../../constants.js';

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
  lynxViewClientLeft: number,
  lynxViewClientTop: number,
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
    const shiftTouch = (t: CloneableObject): CloneableObject => ({
      ...t,
      clientX: (t['clientX'] as number) - lynxViewClientLeft,
      clientY: (t['clientY'] as number) - lynxViewClientTop,
      pageX: (t['pageX'] as number) - lynxViewClientLeft,
      pageY: (t['pageY'] as number) - lynxViewClientTop,
    });
    Object.assign(otherProperties, {
      touches: isTrusted ? touch.map(toCloneableObject).map(shiftTouch) : touch,
      targetTouches: isTrusted
        ? targetTouches.map(toCloneableObject).map(shiftTouch)
        : targetTouches,
      changedTouches: isTrusted
        ? changedTouches.map(toCloneableObject).map(shiftTouch)
        : changedTouches,
    });
    if (touch[0]) {
      detail = {
        x: touch[0].clientX - lynxViewClientLeft,
        y: touch[0].clientY - lynxViewClientTop,
      };
    }
  } else if (type.startsWith('mouse')) {
    const mouseEvent = domEvent as MouseEvent;
    Object.assign(otherProperties, {
      button: mouseEvent.button,
      buttons: mouseEvent.buttons,
      x: mouseEvent.x - lynxViewClientLeft,
      y: mouseEvent.y - lynxViewClientTop,
      clientX: mouseEvent.clientX - lynxViewClientLeft,
      clientY: mouseEvent.clientY - lynxViewClientTop,
      pageX: mouseEvent.pageX - lynxViewClientLeft,
      pageY: mouseEvent.pageY - lynxViewClientTop,
    });
  } else if (type === 'click') {
    const mouseEvent = domEvent as MouseEvent;
    detail = {
      x: mouseEvent.clientX - lynxViewClientLeft,
      y: mouseEvent.clientY - lynxViewClientTop,
    };
  } else if (type === 'layoutchange') {
    const d = detail as {
      left: number;
      right: number;
      top: number;
      bottom: number;
      width: number;
      height: number;
      id: string | null;
    };
    detail = {
      ...d,
      left: d.left - lynxViewClientLeft,
      right: d.right - lynxViewClientLeft,
      top: d.top - lynxViewClientTop,
      bottom: d.bottom - lynxViewClientTop,
    };
  }

  const lynxEventName = W3cEventNameToLynx[type] ?? type;

  return {
    type: lynxEventName,
    timestamp: domEvent.timeStamp,
    // @ts-expect-error
    detail,
    params,
    ...otherProperties,
  };
}
