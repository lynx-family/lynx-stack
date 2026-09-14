/// <reference types="vitest/globals" />

import('./LazyA.jsx');

export function App() {
  return <view />;
}

it('builds lazy chunks that import each other', () => {
  expect(App).toBeTypeOf('function');
});
