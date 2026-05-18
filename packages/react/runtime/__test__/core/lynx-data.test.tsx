import { EventEmitter } from 'node:events';

import { Component, createElement, render } from 'preact';
import { createContext } from 'preact/compat';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentClass } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDataApiShell, createWithDataInState } from '../../src/core/lynx-data.js';

function waitForRender(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function useEmitterListener(emitter: EventEmitter, eventName: string, listener: (...args: unknown[]) => void): void {
  const previousArgsRef = useRef<[string, (...args: unknown[]) => void]>();

  useMemo(() => {
    if (previousArgsRef.current) {
      const [eventName, listener] = previousArgsRef.current;
      emitter.removeListener(eventName, listener);
    }
    emitter.addListener(eventName, listener);
    previousArgsRef.current = [eventName, listener];
  }, [emitter, eventName, listener]);

  useEffect(() => {
    return () => {
      if (previousArgsRef.current) {
        const [eventName, listener] = previousArgsRef.current;
        emitter.removeListener(eventName, listener);
      }
    };
  }, [emitter]);
}

describe('core lynx data API shell', () => {
  let scratch: HTMLDivElement;

  beforeEach(() => {
    globalThis.__LEPUS__ = false;
    scratch = document.createElement('div');
  });

  afterEach(() => {
    render(null, scratch);
    vi.unstubAllGlobals();
  });

  it('updates hook readers from the injected full data reader and marks data-updated', async () => {
    const emitter = new EventEmitter();
    const markDataUpdated = vi.fn();
    let currentData = { msg: 'init' };
    let observed: unknown;

    const api = createDataApiShell(
      {
        createContext,
        useState,
        createElement,
        useDataChanged(eventName, listener) {
          useEmitterListener(emitter, eventName, listener);
        },
      },
      {
        eventName: 'onDataChanged',
        readData: () => currentData,
        markDataUpdated,
      },
    );
    const useData = api.use();

    function App() {
      observed = useData();
      return null;
    }

    render(<App />, scratch);
    expect(observed).toEqual({ msg: 'init' });

    currentData = { msg: 'update' };
    emitter.emit('onDataChanged', { msg: 'update' });
    await waitForRender();

    expect(markDataUpdated).toHaveBeenCalledTimes(1);
    expect(observed).toEqual({ msg: 'update' });

    render(null, scratch);
    expect(emitter.listenerCount('onDataChanged')).toBe(0);
  });

  it('keeps useChanged as a listener-only API', () => {
    const emitter = new EventEmitter();
    const markDataUpdated = vi.fn();
    const callback = vi.fn();

    const api = createDataApiShell(
      {
        createContext,
        useState,
        createElement,
        useDataChanged(eventName, listener) {
          useEmitterListener(emitter, eventName, listener);
        },
      },
      {
        eventName: 'onDataChanged',
        readData: () => ({}),
        markDataUpdated,
      },
    );
    const useChanged = api.useChanged();

    function App() {
      useChanged(callback);
      return null;
    }

    render(<App />, scratch);
    emitter.emit('onDataChanged', { patch: true });

    expect(callback).toHaveBeenCalledWith({ patch: true });
    expect(markDataUpdated).not.toHaveBeenCalled();
  });

  it('wraps class components with initial data, event updates and cleanup', async () => {
    const emitter = new EventEmitter();
    const markDataUpdated = vi.fn();
    let currentData = { msg: 'init' };
    let instance: Component<unknown, { msg?: string; patch?: boolean }> | undefined;
    vi.stubGlobal('lynx', {
      ...globalThis.lynx,
      getJSModule(moduleName: string) {
        expect(moduleName).toBe('GlobalEventEmitter');
        return emitter;
      },
    });

    class App extends Component<unknown, { msg?: string; patch?: boolean }> {
      constructor(props: unknown) {
        super(props);
        instance = this;
      }

      render() {
        return null;
      }
    }

    const withDataInState = createWithDataInState({
      eventName: 'onDataChanged',
      readData: () => currentData,
      markDataUpdated,
    });
    const Wrapped = withDataInState(
      App as unknown as ComponentClass<unknown, { msg?: string; patch?: boolean }>,
    );

    render(createElement(Wrapped), scratch);
    expect(instance?.state).toEqual({ msg: 'init' });
    expect(emitter.listenerCount('onDataChanged')).toBe(1);

    currentData = { msg: 'full' };
    emitter.emit('onDataChanged', { patch: true });
    await waitForRender();

    expect(markDataUpdated).toHaveBeenCalledTimes(1);
    expect(instance?.state).toEqual({ msg: 'init', patch: true });

    render(null, scratch);
    expect(emitter.listenerCount('onDataChanged')).toBe(0);
  });

  it('returns non-class components as-is without registering a listener', () => {
    const emitter = new EventEmitter();
    let currentData = { msg: 'init' };
    vi.stubGlobal('lynx', {
      ...globalThis.lynx,
      getJSModule(moduleName: string) {
        expect(moduleName).toBe('GlobalEventEmitter');
        return emitter;
      },
    });

    function App() {
      return null;
    }

    const withDataInState = createWithDataInState({
      eventName: 'onDataChanged',
      readData: () => currentData,
    });
    const Wrapped = withDataInState(
      App as unknown as ComponentClass<unknown, { msg?: string }>,
    );

    expect(Wrapped).toBe(App);
    render(createElement(Wrapped), scratch);
    expect(emitter.listenerCount('onDataChanged')).toBe(0);

    currentData = { msg: 'update' };
    emitter.emit('onDataChanged', { msg: 'update' });
    expect(emitter.listenerCount('onDataChanged')).toBe(0);
  });
});
