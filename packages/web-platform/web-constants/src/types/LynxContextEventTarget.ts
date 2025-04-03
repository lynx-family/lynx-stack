export const DispatchEventResult = {
  // Event was not canceled by event handler or default event handler.
  NotCanceled: 0,
  // Event was canceled by event handler; i.e. a script handler calling
  // preventDefault.
  CanceledByEventHandler: 1,
  // Event was canceled by the default event handler; i.e. executing the default
  // action.  This result should be used sparingly as it deviates from the DOM
  // Event Dispatch model. Default event handlers really shouldn't be invoked
  // inside of dispatch.
  CanceledByDefaultEventHandler: 2,
  // Event was canceled but suppressed before dispatched to event handler.  This
  // result should be used sparingly; and its usage likely indicates there is
  // potential for a bug. Trusted events may return this code; but untrusted
  // events likely should always execute the event handler the developer intends
  // to execute.
  CanceledBeforeDispatch: 3,
} as const;
export interface LynxContextEventTarget {
  onTriggerEvent?: (event: MessageEvent) => void;

  postMessage(message: any): void;
  dispatchEvent(
    event: MessageEvent,
  ): typeof DispatchEventResult[keyof typeof DispatchEventResult];
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  removeEventListener(
    type: string,
    listener: (event: MessageEvent) => void,
  ): void;
}
