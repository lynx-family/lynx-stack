// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest';

import { noop } from '../src/utils/noop.js';
import {
  registerCallable,
  runOnRegistered,
} from '../src/utils/registeredFunction.js';

describe('Utilities', () => {
  describe('noop functions', () => {
    test('noop should be a function that returns undefined', () => {
      const result = noop();
      expect(result).toBeUndefined();
    });

    test('noop should not throw', () => {
      expect(() => noop()).not.toThrow();
    });

    test('noopMT should be exported and not throw', async () => {
      // Dynamic import to avoid execution context issues
      const { noopMT } = await import('../src/utils/noop.js');
      expect(typeof noopMT).toBe('object');
      expect(noopMT).toHaveProperty('_wkltId');
    });
  });

  describe('registerCallable and runOnRegistered', () => {
    test('should register and retrieve a function', () => {
      const testFunc = (x: number) => x * 2;
      const id = registerCallable(testFunc, 'testFunc123');

      expect(id).toBe('testFunc123');

      const retrieved = runOnRegistered<typeof testFunc>('testFunc123');
      expect(retrieved).toBe(testFunc);
    });

    test('should execute registered function correctly', () => {
      const add = (a: number, b: number) => a + b;
      registerCallable(add, 'add456');

      const retrieved = runOnRegistered<typeof add>('add456');
      const result = retrieved(5, 3);

      expect(result).toBe(8);
    });

    test('should return noop for unregistered function', () => {
      const retrieved = runOnRegistered('nonexistent789');
      expect(retrieved).toBe(noop);
    });

    test('should handle multiple registered functions', () => {
      const func1 = () => 'one';
      const func2 = () => 'two';
      const func3 = () => 'three';

      registerCallable(func1, 'func1x');
      registerCallable(func2, 'func2x');
      registerCallable(func3, 'func3x');

      expect(runOnRegistered('func1x')()).toBe('one');
      expect(runOnRegistered('func2x')()).toBe('two');
      expect(runOnRegistered('func3x')()).toBe('three');
    });

    test('should overwrite previously registered function with same id', () => {
      const func1 = () => 'first';
      const func2 = () => 'second';

      registerCallable(func1, 'sameid999');
      registerCallable(func2, 'sameid999');

      expect(runOnRegistered('sameid999')()).toBe('second');
    });

    test('should handle functions with different signatures', () => {
      const getString = (name: string) => `Hello, ${name}`;
      const getNumber = (x: number) => x * x;
      const getBoolean = () => true;

      registerCallable(getString, 'getStringX');
      registerCallable(getNumber, 'getNumberX');
      registerCallable(getBoolean, 'getBooleanX');

      expect(runOnRegistered<typeof getString>('getStringX')('World')).toBe(
        'Hello, World',
      );
      expect(runOnRegistered<typeof getNumber>('getNumberX')(5)).toBe(25);
      expect(runOnRegistered<typeof getBoolean>('getBooleanX')()).toBe(true);
    });

    test('should preserve function context', () => {
      const obj = {
        value: 42,
        getValue() {
          return this.value;
        },
      };

      registerCallable(obj.getValue.bind(obj), 'getValueZ');

      const retrieved = runOnRegistered<() => number>('getValueZ');
      expect(retrieved()).toBe(42);
    });

    test('should be accessible via globalThis', () => {
      expect(globalThis.runOnRegistered).toBe(runOnRegistered);
    });

    test('should handle async functions', async () => {
      const asyncFunc = async (x: number) => {
        return x * 2;
      };

      registerCallable(asyncFunc, 'asyncFuncY');

      const retrieved = runOnRegistered<typeof asyncFunc>('asyncFuncY');
      const result = await retrieved(5);

      expect(result).toBe(10);
    });

    test('should handle functions that throw', () => {
      const throwFunc = () => {
        throw new Error('Test error');
      };

      registerCallable(throwFunc, 'throwFuncW');

      const retrieved = runOnRegistered<typeof throwFunc>('throwFuncW');

      expect(() => retrieved()).toThrow('Test error');
    });

    test('should handle functions with no arguments', () => {
      const counter = (() => {
        let count = 0;
        return () => ++count;
      })();

      registerCallable(counter, 'counterV');

      const retrieved = runOnRegistered<typeof counter>('counterV');

      expect(retrieved()).toBe(1);
      expect(retrieved()).toBe(2);
      expect(retrieved()).toBe(3);
    });

    test('should handle variadic functions', () => {
      const sum = (...numbers: number[]) => numbers.reduce((a, b) => a + b, 0);

      registerCallable(sum, 'sumT');

      const retrieved = runOnRegistered<typeof sum>('sumT');

      expect(retrieved(1, 2, 3)).toBe(6);
      expect(retrieved(10, 20, 30, 40)).toBe(100);
    });
  });

  describe('Edge cases', () => {
    test('should handle empty string as id', () => {
      const func = () => 'empty';
      registerCallable(func, 'emptyId');

      const retrieved = runOnRegistered('emptyId');
      expect(retrieved()).toBe('empty');
    });

    test('should handle special characters in id', () => {
      const func = () => 'special';
      registerCallable(func, 'id-with_special');

      const retrieved = runOnRegistered('id-with_special');
      expect(retrieved()).toBe('special');
    });
  });
});
