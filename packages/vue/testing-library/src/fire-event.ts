/**
 * fireEvent — dispatches Lynx events through the dual-thread pipeline.
 *
 * Events are dispatched on the JSDOM element (main thread) using
 * @testing-library/dom's createEvent / fireEvent. The PAPI __AddEvent
 * listener intercepts these and calls lynxCoreInject.tt.publishEvent(sign, evt)
 * which switches to the BG thread and invokes the Vue event handler.
 *
 * Event type format: "bindEvent:tap" (matches __AddEvent registration).
 */

import { createEvent, fireEvent as domFireEvent } from '@testing-library/dom';

export const eventMap: Record<
  string,
  { defaultInit: Record<string, unknown> }
> = {
  tap: { defaultInit: {} },
  longtap: { defaultInit: {} },
  touchstart: { defaultInit: {} },
  touchmove: { defaultInit: {} },
  touchcancel: { defaultInit: {} },
  touchend: { defaultInit: {} },
  longpress: { defaultInit: {} },
  scroll: { defaultInit: {} },
  scrollend: { defaultInit: {} },
  focus: { defaultInit: {} },
  blur: { defaultInit: {} },
  layoutchange: { defaultInit: {} },
  transitionend: { defaultInit: {} },
  animationend: { defaultInit: {} },
};

/**
 * Fire a raw DOM event on a JSDOM element.
 * Switches to BG thread before dispatching so event handlers run on BG.
 */
export const fireEvent:
  & Record<string, any>
  & ((
    elem: Element,
    event: Event,
  ) => boolean) = ((elem: Element, event: Event) => {
    const env = (globalThis as any).lynxTestingEnv;
    const isMainThread = (globalThis as any).__MAIN_THREAD__;

    env.switchToBackgroundThread();
    const ans = domFireEvent(elem, event);

    if (isMainThread) {
      env.switchToMainThread();
    }
    return ans;
  }) as any;

// Create named event helpers: fireEvent.tap(elem, init?)
for (const key of Object.keys(eventMap)) {
  fireEvent[key] = (
    elem: Element,
    init?: Record<string, unknown>,
  ): boolean => {
    const env = (globalThis as any).lynxTestingEnv;
    const isMainThread = (globalThis as any).__MAIN_THREAD__;

    env.switchToBackgroundThread();

    const eventType = (init?.eventType as string) || 'bindEvent';
    const eventInit = {
      eventType,
      eventName: key,
      ...eventMap[key].defaultInit,
      ...init,
    };

    const event = createEvent(
      `${eventType}:${key}`,
      elem,
      eventInit,
    );
    Object.assign(event, eventInit);
    const ans = domFireEvent(elem, event);

    if (isMainThread) {
      env.switchToMainThread();
    }
    return ans;
  };
}
