import type { LynxFiberElement } from '@lynx-js/lynx-dom';

export type EventType =
  | 'tap'
  | 'longtap'
  | 'bgload'
  | 'bgerror'
  | 'touchstart'
  | 'touchmove'
  | 'touchcancel'
  | 'touchend'
  | 'longpress'
  | 'transitionstart'
  | 'transitioncancel'
  | 'transitionend'
  | 'animationstart'
  | 'animationiteration'
  | 'animationcancel'
  | 'animationend'
  | 'mousedown'
  | 'mouseup'
  | 'mousemove'
  | 'mouseclick'
  | 'mousedblclick'
  | 'mouselongpress'
  | 'wheel'
  | 'keydown'
  | 'keyup'
  | 'focus'
  | 'blur'
  | 'layoutchange'
  | 'scrolltoupper'
  | 'scrolltolower'
  | 'scroll'
  | 'scrollend'
  | 'contentsizechanged'
  | 'scrolltoupperedge'
  | 'scrolltoloweredge'
  | 'scrolltonormalstate';

export type FireFunction = (
  element: LynxFiberElement,
  event: Event,
) => boolean;
export type FireObject = {
  [K in EventType]: (
    element: LynxFiberElement,
    options?: {},
  ) => boolean;
};
export type CreateFunction = (
  eventName: string,
  node: LynxFiberElement,
  init?: {},
  options?: { EventType?: string; defaultInit?: {} },
) => Event;
export type CreateObject = {
  [K in EventType]: (
    element: LynxFiberElement,
    options?: {},
  ) => Event;
};

export const createEvent: CreateObject & CreateFunction;
export const fireEvent: FireFunction & FireObject;
