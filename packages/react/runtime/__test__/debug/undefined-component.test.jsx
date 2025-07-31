import { expect, test, vi } from 'vitest';

test('preact/debug - Undefined component passed to createElement()', async () => {
  vi.stubGlobal('__MAIN_THREAD__', false)
    .stubGlobal('__LEPUS__', false);

  await import('preact/debug');
  const { root } = await import('../../src/index');

  const a = { b: undefined };

  function Bar() {
    return <a.b />;
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
    `
    [Error: Undefined component passed to createElement()

    You likely forgot to export your component or might have mixed up default and named imports<#text />

      in #text
      in Bar
      in App
    ]
  `,
  );
});
