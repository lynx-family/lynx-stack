import { expect, test } from 'vitest';

import { identity } from './generic';

// Regression test: a `.ts` file must be parsed as TypeScript, not as TSX.
// Parsed as TSX, the `<T>` of the generic arrow function in `./generic.ts` is
// read as the opening tag of a JSX element and the transform fails with
// `Expected ',', got ':'`.
test('a generic arrow function in a `.ts` file is parsed as TypeScript', () => {
  expect(identity(42)).toBe(42);
});
