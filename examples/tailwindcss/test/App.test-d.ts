import { assertType, describe, test } from 'vitest';

import { App } from '@/App.js';
import { cn } from '@/utils.js';
import type { JSX } from '@lynx-js/react';

const handler = (prev: boolean): boolean => !prev;

describe('App Component Type Tests', () => {
  test('App should return JSX.Element', () => {
    const element = App();
    assertType<JSX.Element>(element);
  });

  test('bindtap handler should toggle boolean state', () => {
    assertType<(prev: boolean) => boolean>(handler);
  });
});

describe('cn utility', () => {
  test('cn() returns string', () => {
    const result = cn('a', 'b', 'c');
    assertType<string>(result);
  });
});
