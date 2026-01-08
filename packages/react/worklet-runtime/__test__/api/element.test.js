// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnimationOperation } from '../../src/api/animation/animation';
import { Element, setShouldFlush } from '../../src/api/element';
import { initWorklet } from '../../src/workletRuntime';

beforeEach(() => {
  globalThis.SystemInfo = {
    lynxSdkVersion: '2.16',
  };
  initWorklet();
  vi.useFakeTimers();

  globalThis.__SetAttribute = vi.fn();
  globalThis.__AddInlineStyle = vi.fn();
  globalThis.__GetAttributeByName = vi.fn();
  globalThis.__GetAttributeNames = vi.fn();
  globalThis.__QuerySelector = vi.fn();
  globalThis.__QuerySelectorAll = vi.fn();
  globalThis.__GetComputedStyleByKey = vi.fn();
  globalThis.__InvokeUIMethod = vi.fn();
  globalThis.__FlushElementTree = vi.fn();
  globalThis.__ElementAnimate = vi.fn();
});

afterEach(() => {
  delete globalThis.lynxWorkletImpl;
  vi.useRealTimers();
  vi.clearAllMocks();
  setShouldFlush(true);
});

describe('Element', () => {
  it('should set attribute and flush', async () => {
    const element = new Element('element-instance');
    element.setAttribute('foo', 'bar');
    expect(globalThis.__SetAttribute).toHaveBeenCalledWith('element-instance', 'foo', 'bar');
    expect(globalThis.__FlushElementTree).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(globalThis.__FlushElementTree).toHaveBeenCalledTimes(1);
  });

  it('should set style property and flush', async () => {
    const element = new Element('element-instance');
    element.setStyleProperty('color', 'red');
    expect(globalThis.__AddInlineStyle).toHaveBeenCalledWith('element-instance', 'color', 'red');
    expect(globalThis.__FlushElementTree).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(globalThis.__FlushElementTree).toHaveBeenCalledTimes(1);
  });

  it('should set style properties and flush', async () => {
    const element = new Element('element-instance');
    const styles = { color: 'red', fontSize: '16px' };
    element.setStyleProperties(styles);
    expect(globalThis.__AddInlineStyle).toHaveBeenCalledWith('element-instance', 'color', 'red');
    expect(globalThis.__AddInlineStyle).toHaveBeenCalledWith('element-instance', 'fontSize', '16px');
    expect(globalThis.__FlushElementTree).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(globalThis.__FlushElementTree).toHaveBeenCalledTimes(1);
  });

  it('should get attribute', () => {
    globalThis.__GetAttributeByName.mockReturnValue('bar');
    const element = new Element('element-instance');
    const value = element.getAttribute('foo');
    expect(globalThis.__GetAttributeByName).toHaveBeenCalledWith('element-instance', 'foo');
    expect(value).toBe('bar');
  });

  it('should get attribute names', () => {
    globalThis.__GetAttributeNames.mockReturnValue(['foo', 'class']);
    const element = new Element('element-instance');
    const names = element.getAttributeNames();
    expect(globalThis.__GetAttributeNames).toHaveBeenCalledWith('element-instance');
    expect(names).toEqual(['foo', 'class']);
  });

  it('should query selector', () => {
    globalThis.__QuerySelector.mockReturnValue('child-element');
    const element = new Element('element-instance');
    const child = element.querySelector('.child');
    expect(globalThis.__QuerySelector).toHaveBeenCalledWith('element-instance', '.child', {});
    expect(child).toBeInstanceOf(Element);
    expect(child.element).toBe('child-element');
  });

  it('should return null when query selector finds nothing', () => {
    globalThis.__QuerySelector.mockReturnValue(null);
    const element = new Element('element-instance');
    const child = element.querySelector('.child');
    expect(globalThis.__QuerySelector).toHaveBeenCalledWith('element-instance', '.child', {});
    expect(child).toBeNull();
  });

  it('should query selector all', () => {
    globalThis.__QuerySelectorAll.mockReturnValue(['child1', 'child2']);
    const element = new Element('element-instance');
    const children = element.querySelectorAll('.child');
    expect(globalThis.__QuerySelectorAll).toHaveBeenCalledWith('element-instance', '.child', {});
    expect(children).toHaveLength(2);
    expect(children[0]).toBeInstanceOf(Element);
    expect(children[1]).toBeInstanceOf(Element);
    expect(children[0].element).toBe('child1');
    expect(children[1].element).toBe('child2');
  });

  it('should get computed style by key', () => {
    globalThis.SystemInfo.lynxSdkVersion = '3.5';
    globalThis.__GetComputedStyleByKey.mockReturnValue('16px');
    const element = new Element('element-instance');
    const value = element.getComputedStyleProperty('fontSize');
    expect(globalThis.__GetComputedStyleByKey).toHaveBeenCalledWith('element-instance', 'fontSize');
    expect(value).toBe('16px');
  });

  it('should get computed style for color property', () => {
    globalThis.SystemInfo.lynxSdkVersion = '3.5';
    globalThis.__GetComputedStyleByKey.mockReturnValue('rgb(255, 0, 0)');
    const element = new Element('element-instance');
    const value = element.getComputedStyleProperty('color');
    expect(globalThis.__GetComputedStyleByKey).toHaveBeenCalledWith('element-instance', 'color');
    expect(value).toBe('rgb(255, 0, 0)');
  });

  it('should get computed style for display property', () => {
    globalThis.SystemInfo.lynxSdkVersion = '3.5';
    globalThis.__GetComputedStyleByKey.mockReturnValue('flex');
    const element = new Element('element-instance');
    const value = element.getComputedStyleProperty('display');
    expect(globalThis.__GetComputedStyleByKey).toHaveBeenCalledWith('element-instance', 'display');
    expect(value).toBe('flex');
  });

  it('should throw when get computed style value with low sdk version', () => {
    globalThis.SystemInfo.lynxSdkVersion = '3.4';
    const element = new Element('element-instance');
    expect(() => element.getComputedStyleProperty('width')).toThrow(
      'getComputedStyleProperty requires Lynx sdk version 3.5',
    );
  });

  it('should throw when get computed style value with empty key', () => {
    globalThis.SystemInfo.lynxSdkVersion = '3.5';
    const element = new Element('element-instance');
    expect(() => element.getComputedStyleProperty('')).toThrow(
      'getComputedStyleProperty: key is required',
    );
  });

  it('should invoke method and resolve', async () => {
    globalThis.__InvokeUIMethod.mockImplementation((_element, _method, _params, callback) => {
      callback({ code: 0, data: 'success' });
    });
    const element = new Element('element-instance');
    const promise = element.invoke('play', { speed: 2 });
    expect(globalThis.__FlushElementTree).not.toHaveBeenCalled();
    expect(globalThis.__InvokeUIMethod).toHaveBeenCalledWith(
      'element-instance',
      'play',
      { speed: 2 },
      expect.any(Function),
    );
    await expect(promise).resolves.toBe('success');
    expect(globalThis.__FlushElementTree).toHaveBeenCalledTimes(1);
  });

  it('should invoke method and reject', async () => {
    const errorResponse = { code: 1, message: 'error' };
    globalThis.__InvokeUIMethod.mockImplementation((_element, _method, _params, callback) => {
      callback(errorResponse);
    });
    const element = new Element('element-instance');
    const promise = element.invoke('play');
    expect(globalThis.__FlushElementTree).not.toHaveBeenCalled();
    await expect(promise).rejects.toThrow('UI method invoke: ' + JSON.stringify(errorResponse));
    expect(globalThis.__FlushElementTree).toHaveBeenCalledTimes(1);
  });

  it('should flush only once for multiple sync operations', async () => {
    const element = new Element('element-instance');
    element.setAttribute('a', '1');
    element.setStyleProperty('color', 'blue');
    element.setStyleProperties({ margin: '10px' });
    expect(globalThis.__FlushElementTree).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(globalThis.__FlushElementTree).toHaveBeenCalledTimes(1);
  });

  it('should start animation when created', () => {
    const element = new Element('element-instance');
    const animation = element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000 });
    expect(globalThis.__ElementAnimate).toHaveBeenCalledWith('element-instance', [
      AnimationOperation.START,
      animation.id,
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 1000 },
    ]);
  });

  it('should start animation when pass number as option', () => {
    const element = new Element('element-instance');
    const animation = element.animate([{ opacity: 0 }, { opacity: 1 }], 1000);
    expect(globalThis.__ElementAnimate).toHaveBeenCalledWith('element-instance', [
      AnimationOperation.START,
      animation.id,
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 1000 },
    ]);
  });

  it('animation should work even if no options', () => {
    const element = new Element('element-instance');
    const animation = element.animate([{ opacity: 0 }, { opacity: 1 }]);
    expect(globalThis.__ElementAnimate).toHaveBeenCalledWith('element-instance', [
      AnimationOperation.START,
      animation.id,
      [{ opacity: 0 }, { opacity: 1 }],
      {},
    ]);
  });

  it('should cancel animation when canceled', () => {
    const element = new Element('element-instance');
    const animation = element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000 });
    animation.cancel();
    expect(globalThis.__ElementAnimate).toHaveBeenCalledWith('element-instance', [
      AnimationOperation.CANCEL,
      animation.id,
    ]);
  });

  it('should pause animation when paused', () => {
    const element = new Element('element-instance');
    const animation = element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000 });
    animation.pause();
    expect(globalThis.__ElementAnimate).toHaveBeenCalledWith('element-instance', [
      AnimationOperation.PAUSE,
      animation.id,
    ]);
  });

  it('should play animation when played', () => {
    const element = new Element('element-instance');
    const animation = element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000 });
    expect(globalThis.__ElementAnimate).toHaveBeenCalledWith('element-instance', [
      AnimationOperation.START,
      animation.id,
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 1000 },
    ]);
    animation.play();
    expect(globalThis.__ElementAnimate).toHaveBeenCalledWith('element-instance', [
      AnimationOperation.PLAY,
      animation.id,
    ]);
  });

  it('should not flush when shouldFlush is false', async () => {
    const element = new Element('element-instance');
    setShouldFlush(false);
    element.setAttribute('a', '1');
    await vi.runAllTimersAsync();
    expect(globalThis.__FlushElementTree).not.toHaveBeenCalled();

    setShouldFlush(true);
    element.setAttribute('b', '2');
    await vi.runAllTimersAsync();
    expect(globalThis.__FlushElementTree).toHaveBeenCalledTimes(1);
  });
});
