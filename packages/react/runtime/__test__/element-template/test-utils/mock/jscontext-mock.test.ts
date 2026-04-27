import { describe, expect, it } from 'vitest';

import { ElementTemplateEnvManager } from '../debug/envManager.js';
import type { ContextEvent, ContextEventTarget } from './mockNativePapi/context.js';

interface ThreadFlags {
  __LEPUS__: boolean | undefined;
  __JS__: boolean | undefined;
  __MAIN_THREAD__: boolean | undefined;
  __BACKGROUND__: boolean | undefined;
}

interface LynxMock {
  getJSContext(): ContextEventTarget;
  getCoreContext(): ContextEventTarget;
}

describe('lynx.getJSContext mock', () => {
  it('throws when calling cross-thread context methods', () => {
    const envManager = new ElementTemplateEnvManager();
    envManager.resetEnv('background');

    const lynx = (globalThis as unknown as { lynx: LynxMock }).lynx;
    const jsContext = lynx.getJSContext();
    const coreContext = lynx.getCoreContext();

    const noop = () => {};

    envManager.switchToMainThread();
    expect(() => coreContext.addEventListener('ping', noop)).toThrowError(
      /coreContext\.addEventListener can only be called on background thread/,
    );
    expect(() => coreContext.dispatchEvent({ type: 'ping', data: 1 })).toThrowError(
      /coreContext\.dispatchEvent can only be called on background thread/,
    );

    envManager.switchToBackground();
    expect(() => jsContext.addEventListener('pong', noop)).toThrowError(
      /jsContext\.addEventListener can only be called on main thread/,
    );
    expect(() => jsContext.postMessage('x')).toThrowError(
      /jsContext\.postMessage can only be called on main thread/,
    );
  });

  it('dispatches events between jsContext and coreContext', () => {
    const envManager = new ElementTemplateEnvManager();
    envManager.resetEnv('background');

    const lynx = (globalThis as unknown as { lynx: LynxMock }).lynx;
    const jsContext = lynx.getJSContext();
    const coreContext = lynx.getCoreContext();

    const receivedOnJs: unknown[] = [];
    const onJs = (e: ContextEvent) => {
      const g = globalThis as unknown as ThreadFlags;
      expect(g.__MAIN_THREAD__).toBe(true);
      expect(g.__BACKGROUND__).toBe(false);
      receivedOnJs.push(e.data);
    };

    envManager.switchToMainThread();
    jsContext.addEventListener('ping', onJs);

    envManager.switchToBackground();
    expect(coreContext.dispatchEvent({ type: 'ping', data: 1 })).toBe(0);
    expect(receivedOnJs).toEqual([]);
    envManager.switchToMainThread();
    expect(receivedOnJs).toEqual([1]);
    jsContext.removeEventListener('ping', onJs);

    envManager.switchToBackground();
    coreContext.dispatchEvent({ type: 'ping', data: 2 });
    envManager.switchToMainThread();
    expect(receivedOnJs).toEqual([1]);

    envManager.switchToBackground();
    const receivedOnCore: unknown[] = [];
    const onPong = (e: ContextEvent) => {
      const g = globalThis as unknown as ThreadFlags;
      expect(g.__MAIN_THREAD__).toBe(false);
      expect(g.__BACKGROUND__).toBe(true);
      receivedOnCore.push(e.data);
    };
    coreContext.addEventListener('pong', onPong);

    envManager.switchToMainThread();
    expect(jsContext.dispatchEvent({ type: 'pong', data: 3 })).toBe(0);
    expect(receivedOnCore).toEqual([]);
    envManager.switchToBackground();
    expect(receivedOnCore).toEqual([3]);

    coreContext.removeEventListener('pong', onPong);
  });

  it('supports postMessage in both directions', () => {
    const envManager = new ElementTemplateEnvManager();
    envManager.resetEnv('background');

    const lynx = (globalThis as unknown as { lynx: LynxMock }).lynx;
    const jsContext = lynx.getJSContext();
    const coreContext = lynx.getCoreContext();

    const receivedOnJs: unknown[] = [];
    const onMessageOnJs = (e: ContextEvent) => {
      const g = globalThis as unknown as ThreadFlags;
      expect(g.__MAIN_THREAD__).toBe(true);
      expect(g.__BACKGROUND__).toBe(false);
      receivedOnJs.push(e.data);
    };
    envManager.switchToMainThread();
    jsContext.addEventListener('message', onMessageOnJs);

    envManager.switchToBackground();
    coreContext.postMessage('fromCore');
    expect(receivedOnJs).toEqual([]);
    envManager.switchToMainThread();
    expect(receivedOnJs).toEqual(['fromCore']);

    const receivedOnCore: unknown[] = [];
    const onMessageOnCore = (e: ContextEvent) => {
      const g = globalThis as unknown as ThreadFlags;
      expect(g.__MAIN_THREAD__).toBe(false);
      expect(g.__BACKGROUND__).toBe(true);
      receivedOnCore.push(e.data);
    };

    envManager.switchToBackground();
    coreContext.addEventListener('message', onMessageOnCore);

    envManager.switchToMainThread();
    jsContext.postMessage('fromJs');
    expect(receivedOnCore).toEqual([]);
    envManager.switchToBackground();
    expect(receivedOnCore).toEqual(['fromJs']);

    coreContext.removeEventListener('message', onMessageOnCore);

    envManager.switchToMainThread();
    jsContext.removeEventListener('message', onMessageOnJs);
  });
});
