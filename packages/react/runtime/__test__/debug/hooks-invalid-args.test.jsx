import { expect, test, vi } from 'vitest';

test('preact/debug - Invalid argument passed to hook', async () => {
  vi.stubGlobal('__MAIN_THREAD__', false)
    .stubGlobal('__LEPUS__', false);

  await import('preact/debug');
  const { root, useEffect, useState } = await import('../../src/index');

  function Bar() {
    useState(0);
    useEffect(() => {}, [
      NaN,
    ]);
    return null;
  }

  function Foo(props) {
    return props.children;
  }

  function App() {
    return (
      <Foo>
        <Bar />
      </Foo>
    );
  }

  expect(() => root.render(<App />)).toThrowErrorMatchingInlineSnapshot(
    `[Error: Invalid argument passed to hook. Hooks should not be called with NaN in the dependency array. Hook index 1 in component Bar was called with NaN.]`,
  );
});
