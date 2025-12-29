import { expect, test, vi } from 'vitest';

test('preact/debug - Too many re-renders', async () => {
  vi.stubGlobal('__MAIN_THREAD__', false)
    .stubGlobal('__LEPUS__', false);

  await import('preact/debug');
  const { root, useState } = await import('../../src/index');

  function Bar() {
    const [cnt, setCnt] = useState(0);

    setCnt(curr => curr + 1);

    return <text>{cnt}</text>;
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
    `[Error: Too many re-renders. This is limited to prevent an infinite loop which may lock up your browser. The component causing this is: Bar]`,
  );
});
