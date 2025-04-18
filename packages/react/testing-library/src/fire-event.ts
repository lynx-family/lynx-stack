// @ts-nocheck
import { fireEvent as domFireEvent, createEvent } from '@testing-library/dom';

let NodesRef = lynx.createSelectorQuery().selectUniqueID(-1).constructor;
function getElement(elemOrNodesRef) {
  if (elemOrNodesRef instanceof NodesRef) {
    return __GetElementByUniqueId(
      Number(elemOrNodesRef._nodeSelectToken.identifier),
    );
  } else if (elemOrNodesRef?.constructor?.name === 'HTMLUnknownElement') {
    return elemOrNodesRef;
  } else {
    throw new Error(
      'Invalid element, got: ' + elemOrNodesRef.constructor?.name,
    );
  }
}
// Similar to RTL we make are own fireEvent helper that just calls DTL's fireEvent with that
// we can that any specific behaviors to the helpers we need
export const fireEvent: any = (elemOrNodesRef, ...args) => {
  const isMainThread = __MAIN_THREAD__;

  // switch to background thread
  lynxEnv.switchToBackgroundThread();

  const elem = getElement(elemOrNodesRef);

  let ans = domFireEvent(elem, ...args);

  if (isMainThread) {
    // switch back to main thread
    lynxEnv.switchToMainThread();
  }

  return ans;
};

export const eventMap = {
  // LynxBindCatchEvent Events
  tap: {
    defaultInit: {},
  },
  longtap: {
    defaultInit: {},
  },
  // LynxEvent Events
  bgload: {
    defaultInit: {},
  },
  bgerror: {
    defaultInit: {},
  },
  touchstart: {
    defaultInit: {},
  },
  touchmove: {
    defaultInit: {},
  },
  touchcancel: {
    defaultInit: {},
  },
  touchend: {
    defaultInit: {},
  },
  longpress: {
    defaultInit: {},
  },
  transitionstart: {
    defaultInit: {},
  },
  transitioncancel: {
    defaultInit: {},
  },
  transitionend: {
    defaultInit: {},
  },
  animationstart: {
    defaultInit: {},
  },
  animationiteration: {
    defaultInit: {},
  },
  animationcancel: {
    defaultInit: {},
  },
  animationend: {
    defaultInit: {},
  },
  mousedown: {
    defaultInit: {},
  },
  mouseup: {
    defaultInit: {},
  },
  mousemove: {
    defaultInit: {},
  },
  mouseclick: {
    defaultInit: {},
  },
  mousedblclick: {
    defaultInit: {},
  },
  mouselongpress: {
    defaultInit: {},
  },
  wheel: {
    defaultInit: {},
  },
  keydown: {
    defaultInit: {},
  },
  keyup: {
    defaultInit: {},
  },
  focus: {
    defaultInit: {},
  },
  blur: {
    defaultInit: {},
  },
  layoutchange: {
    defaultInit: {},
  },

  scrolltoupper: {
    defaultInit: {},
  },
  scrolltolower: {
    defaultInit: {},
  },
  scroll: {
    defaultInit: {},
  },
  scrollend: {
    defaultInit: {},
  },
  contentsizechanged: {
    defaultInit: {},
  },
  scrolltoupperedge: {
    defaultInit: {},
  },
  scrolltoloweredge: {
    defaultInit: {},
  },
  scrolltonormalstate: {
    defaultInit: {},
  },
};

Object.keys(eventMap).forEach((key) => {
  fireEvent[key] = (elemOrNodesRef, init = {}) => {
    const isMainThread = __MAIN_THREAD__;
    // switch to background thread
    lynxEnv.switchToBackgroundThread();

    const elem = getElement(elemOrNodesRef);
    const eventType = init?.['eventType'] || 'bindEvent';
    init = {
      eventType,
      eventName: key,
      ...eventMap[key].defaultInit,
      ...init,
    };

    const event = createEvent(
      `${eventType}:${key}`,
      elem,
      init,
    );
    Object.assign(event, init);
    const ans = domFireEvent(
      elem,
      event,
    );

    if (isMainThread) {
      // switch back to main thread
      lynxEnv.switchToMainThread();
    }

    return ans;
  };
});
