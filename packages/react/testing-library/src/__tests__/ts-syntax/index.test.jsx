import { expect, test } from 'vitest';

import { identity } from './generic';

// Regression test: `./generic.ts` must be parsed as TypeScript, not as TSX.
test('a generic arrow function in a `.ts` file is parsed as TypeScript', () => {
  expect(identity(42)).toBe(42);
});
