import { expect, test, vi } from 'vitest';

test('preact/debug - Objects are not valid as a child', async () => {
  vi.stubGlobal('__MAIN_THREAD__', false)
    .stubGlobal('__LEPUS__', false);

  await import('preact/debug');
  const { root } = await import('../../src/index');

  function Bar() {
    return { foo: 'foo', bar: 'bar', baz: 'baz' };
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
    [Error: Objects are not valid as a child. Encountered an object with the keys {foo,bar,baz,__,__b,__i,__u}.

      in Bar
      in App
    ]
  `,
  );
});
