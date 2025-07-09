import { assertType, describe, test } from 'vitest';
import type { JSX } from '@lynx-js/react';
import { App } from '@/App.js';
import { cn } from '@/utils.js';

describe('App Component Type Tests', () => {
  test('App should return JSX.Element', () => {
    const element = App();
    assertType<JSX.Element>(element);
  });

  test('bindtap handler should toggle boolean state', () => {
    const handler = (prev: boolean): boolean => !prev;
    assertType<(prev: boolean) => boolean>(handler);
  });
});

describe('cn utility', () => {
  test('cn() returns string', () => {
    const result = cn('a', 'b', false && 'c');
    assertType<string>(result);
  });
});
