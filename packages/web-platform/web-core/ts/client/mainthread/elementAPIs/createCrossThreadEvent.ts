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
    // Each Touch keeps its original `clientX/clientY` (viewport) and
    // `pageX/pageY` (document) for Web interop; `x/y` is added in lynx-view
    // local space for native Lynx parity. The guard skips touches that do
    // not carry numeric client coords (e.g. synthetic test inputs).
    const addLynxViewLocalCoords = (t: CloneableObject): CloneableObject => {
      const cx = t['clientX'];
      const cy = t['clientY'];
      if (typeof cx === 'number' && typeof cy === 'number') {
        return {
          ...t,
          x: cx - lynxViewClientLeft,
          y: cy - lynxViewClientTop,
        };
      }
      return t;
    };
    Object.assign(otherProperties, {
      touches: touch.map(toCloneableObject).map(addLynxViewLocalCoords),
      targetTouches: targetTouches.map(toCloneableObject).map(
        addLynxViewLocalCoords,
      ),
      changedTouches: changedTouches.map(toCloneableObject).map(
        addLynxViewLocalCoords,
      ),
    });
    if (touch[0]) {
      detail = {
        x: touch[0].clientX - lynxViewClientLeft,
        y: touch[0].clientY - lynxViewClientTop,
      };
    }
  } else if (type.startsWith('mouse')) {
    const mouseEvent = domEvent as MouseEvent;
    // `x/y` are lynx-view-relative (native Lynx parity); `clientX/clientY`
    // and `pageX/pageY` keep their Web-standard meaning so handlers can
    // still reach viewport/document coordinates.
    Object.assign(otherProperties, {
      button: mouseEvent.button,
      buttons: mouseEvent.buttons,
      x: mouseEvent.clientX - lynxViewClientLeft,
      y: mouseEvent.clientY - lynxViewClientTop,
      clientX: mouseEvent.clientX,
      clientY: mouseEvent.clientY,
      pageX: mouseEvent.pageX,
      pageY: mouseEvent.pageY,
    });
  } else if (type === 'click') {
    const mouseEvent = domEvent as MouseEvent;
    detail = {
      x: mouseEvent.clientX - lynxViewClientLeft,
      y: mouseEvent.clientY - lynxViewClientTop,
    };
    // Web-standard viewport/document coords live alongside `detail`.
    Object.assign(otherProperties, {
      clientX: mouseEvent.clientX,
      clientY: mouseEvent.clientY,
      pageX: mouseEvent.pageX,
      pageY: mouseEvent.pageY,
    });
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
  } else if (type === 'keydown' || type === 'keyup') {
    // `keyCode` is deprecated by the DOM spec but forwarded here for parity
    // with iOS/Android, which surface a numeric `keyCode` to JS.
    Object.assign(otherProperties, {
      key: domEvent.key,
      code: domEvent.code,
      keyCode: domEvent.keyCode,
      shiftKey: domEvent.shiftKey,
      altKey: domEvent.altKey,
      ctrlKey: domEvent.ctrlKey,
      metaKey: domEvent.metaKey,
    });
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
