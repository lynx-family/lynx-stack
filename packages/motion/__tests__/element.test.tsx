// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ElementCompt } from '../src/polyfill/element.js';

// These are direct unit tests that don't run in main thread
// They test the ElementCompt class logic directly

describe('ElementCompt (unit tests)', () => {
  let mockElement: any;
  let mockSetStyleProperty: ReturnType<typeof vi.fn>;
  let mockSetStyleProperties: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetStyleProperty = vi.fn();
    mockSetStyleProperties = vi.fn();
    mockElement = {
      element: { id: 'test' },
      setStyleProperty: mockSetStyleProperty,
      setStyleProperties: mockSetStyleProperties,
    };

    // Mock global __GetComputedStyleByKey
    (globalThis as any).__GetComputedStyleByKey = vi.fn(
      (_element: any, prop: string) => {
        const mockStyles: Record<string, string> = {
          width: '100px',
          height: '50px',
          left: '10px',
          top: '20px',
          backgroundColor: 'red',
          color: 'blue',
          fontSize: '16px',
          margin: '5px',
          padding: '10px',
          display: 'block',
          position: 'absolute',
          right: '30px',
          bottom: '40px',
        };
        return mockStyles[prop] || '';
      },
    );
  });

  afterEach(() => {
    delete (globalThis as any).__GetComputedStyleByKey;
    vi.restoreAllMocks();
  });

  test('should create instance with element', () => {
    const compt = new ElementCompt(mockElement);
    expect(compt).toBeDefined();
  });

  test('getComputedStyle should return proxy that reads style', () => {
    const compt = new ElementCompt(mockElement);
    const computed = compt.getComputedStyle();

    expect(computed.width).toBe('100px');
    expect(computed.height).toBe('50px');
    expect((globalThis as any).__GetComputedStyleByKey).toHaveBeenCalled();
  });

  test('style proxy set should call element.setStyleProperty', () => {
    const compt = new ElementCompt(mockElement);

    compt.style.opacity = '0.5';

    expect(mockSetStyleProperty).toHaveBeenCalledWith('opacity', '0.5');
  });

  test('style proxy set with transform=none should use scale(1,1)', () => {
    const compt = new ElementCompt(mockElement);

    compt.style.transform = 'none';

    expect(mockSetStyleProperty).toHaveBeenCalledWith(
      'transform',
      'scale(1, 1)',
    );
  });

  test('style proxy get should call getStyleProperty', () => {
    const compt = new ElementCompt(mockElement);

    const width = compt.style.width;

    expect(width).toBe('100px');
  });

  test('style assignment should call setStyleProperties', () => {
    const compt = new ElementCompt(mockElement);

    compt.style = { width: '200px', height: '150px' };

    expect(mockSetStyleProperties).toHaveBeenCalledWith({
      width: '200px',
      height: '150px',
    });
  });

  test('backgroundColor getter/setter', () => {
    const compt = new ElementCompt(mockElement);

    expect(compt.backgroundColor).toBe('red');
    compt.backgroundColor = 'blue';
    expect(mockSetStyleProperty).toHaveBeenCalledWith(
      'backgroundColor',
      'blue',
    );
  });

  test('color getter/setter', () => {
    const compt = new ElementCompt(mockElement);

    expect(compt.color).toBe('blue');
    compt.color = 'green';
    expect(mockSetStyleProperty).toHaveBeenCalledWith('color', 'green');
  });

  test('fontSize getter/setter', () => {
    const compt = new ElementCompt(mockElement);

    expect(compt.fontSize).toBe('16px');
    compt.fontSize = '24px';
    expect(mockSetStyleProperty).toHaveBeenCalledWith('fontSize', '24px');
  });

  test('width getter/setter', () => {
    const compt = new ElementCompt(mockElement);

    expect(compt.width).toBe('100px');
    compt.width = '200px';
    expect(mockSetStyleProperty).toHaveBeenCalledWith('width', '200px');
  });

  test('height getter/setter', () => {
    const compt = new ElementCompt(mockElement);

    expect(compt.height).toBe('50px');
    compt.height = '100px';
    expect(mockSetStyleProperty).toHaveBeenCalledWith('height', '100px');
  });

  test('margin getter/setter', () => {
    const compt = new ElementCompt(mockElement);

    expect(compt.margin).toBe('5px');
    compt.margin = '10px';
    expect(mockSetStyleProperty).toHaveBeenCalledWith('margin', '10px');
  });

  test('padding getter/setter', () => {
    const compt = new ElementCompt(mockElement);

    expect(compt.padding).toBe('10px');
    compt.padding = '20px';
    expect(mockSetStyleProperty).toHaveBeenCalledWith('padding', '20px');
  });

  test('display getter/setter', () => {
    const compt = new ElementCompt(mockElement);

    expect(compt.display).toBe('block');
    compt.display = 'flex';
    expect(mockSetStyleProperty).toHaveBeenCalledWith('display', 'flex');
  });

  test('position getter/setter', () => {
    const compt = new ElementCompt(mockElement);

    expect(compt.position).toBe('absolute');
    compt.position = 'relative';
    expect(mockSetStyleProperty).toHaveBeenCalledWith('position', 'relative');
  });

  test('top getter/setter', () => {
    const compt = new ElementCompt(mockElement);

    expect(compt.top).toBe('20px');
    compt.top = '0px';
    expect(mockSetStyleProperty).toHaveBeenCalledWith('top', '0px');
  });

  test('left getter/setter', () => {
    const compt = new ElementCompt(mockElement);

    expect(compt.left).toBe('10px');
    compt.left = '0px';
    expect(mockSetStyleProperty).toHaveBeenCalledWith('left', '0px');
  });

  test('right getter/setter', () => {
    const compt = new ElementCompt(mockElement);

    expect(compt.right).toBe('30px');
    compt.right = '0px';
    expect(mockSetStyleProperty).toHaveBeenCalledWith('right', '0px');
  });

  test('bottom getter/setter', () => {
    const compt = new ElementCompt(mockElement);

    expect(compt.bottom).toBe('40px');
    compt.bottom = '0px';
    expect(mockSetStyleProperty).toHaveBeenCalledWith('bottom', '0px');
  });

  test('getBoundingClientRect should calculate rect from styles', () => {
    const compt = new ElementCompt(mockElement);

    const rect = compt.getBoundingClientRect();

    expect(rect.width).toBe(100);
    expect(rect.height).toBe(50);
    expect(rect.left).toBe(10);
    expect(rect.top).toBe(20);
    expect(rect.right).toBe(110); // left + width
    expect(rect.bottom).toBe(70); // top + height
    expect(rect.x).toBe(10);
    expect(rect.y).toBe(20);
  });
});
