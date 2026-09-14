import { beforeEach, describe, expect, it, rs } from '@rstest/core';

beforeEach(() => {
  lynxTestingEnv.reset();
});

// The real engine routes ContextProxy events by comparing the event target
// with the dispatching proxy's origin (context_proxy.cc): equal means the
// event is delivered locally on that proxy and never crosses threads.
describe('ContextProxy routing', () => {
  it('main thread getJSContext().dispatchEvent reaches background getCoreContext() listeners', () => {
    const listener = rs.fn();

    lynxTestingEnv.switchToBackgroundThread();
    lynx.getCoreContext().addEventListener('ping', listener);

    lynxTestingEnv.switchToMainThread();
    lynx.getJSContext().dispatchEvent({ type: 'ping', data: { n: 1 } });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      data: { n: 1 },
      origin: 'CoreContext',
    });
  });

  it('background getCoreContext().dispatchEvent reaches main thread getJSContext() listeners', () => {
    const listener = rs.fn();

    lynxTestingEnv.switchToMainThread();
    lynx.getJSContext().addEventListener('pong', listener);

    lynxTestingEnv.switchToBackgroundThread();
    lynx.getCoreContext().dispatchEvent({ type: 'pong', data: { n: 2 } });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      data: { n: 2 },
      origin: 'JSContext',
    });
  });

  it('main thread getCoreContext().dispatchEvent is a self-loop and never reaches the background thread', () => {
    const backgroundListener = rs.fn();
    const mainThreadListener = rs.fn();

    lynxTestingEnv.switchToBackgroundThread();
    lynx.getCoreContext().addEventListener('ping', backgroundListener);

    lynxTestingEnv.switchToMainThread();
    lynx.getCoreContext().addEventListener('ping', mainThreadListener);
    lynx.getCoreContext().dispatchEvent({ type: 'ping', data: undefined });

    expect(backgroundListener).not.toHaveBeenCalled();
    expect(mainThreadListener).toHaveBeenCalledTimes(1);
  });

  it('background getJSContext().dispatchEvent is a self-loop and never reaches the main thread', () => {
    const mainThreadListener = rs.fn();
    const backgroundListener = rs.fn();

    lynxTestingEnv.switchToMainThread();
    lynx.getJSContext().addEventListener('pong', mainThreadListener);

    lynxTestingEnv.switchToBackgroundThread();
    lynx.getJSContext().addEventListener('pong', backgroundListener);
    lynx.getJSContext().dispatchEvent({ type: 'pong', data: undefined });

    expect(mainThreadListener).not.toHaveBeenCalled();
    expect(backgroundListener).toHaveBeenCalledTimes(1);
  });

  it('listeners run with the receiving thread globals active, and the dispatching thread is restored', () => {
    let mainThreadFlagInListener;

    lynxTestingEnv.switchToBackgroundThread();
    lynx.getCoreContext().addEventListener('ping', () => {
      mainThreadFlagInListener = __MAIN_THREAD__;
    });

    lynxTestingEnv.switchToMainThread();
    lynx.getJSContext().dispatchEvent({ type: 'ping', data: undefined });

    expect(mainThreadFlagInListener).toBe(false);
    expect(__MAIN_THREAD__).toBe(true);
  });

  it('removeEventListener detaches a listener', () => {
    const listener = rs.fn();

    lynxTestingEnv.switchToBackgroundThread();
    lynx.getCoreContext().addEventListener('ping', listener);
    lynx.getCoreContext().removeEventListener('ping', listener);

    lynxTestingEnv.switchToMainThread();
    lynx.getJSContext().dispatchEvent({ type: 'ping', data: undefined });

    expect(listener).not.toHaveBeenCalled();
  });
});
