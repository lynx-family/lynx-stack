import { expect, test, vi } from 'vitest';

test('preact/debug - Invalid type passed to createElement()', async () => {
  vi.stubGlobal('__MAIN_THREAD__', false)
    .stubGlobal('__LEPUS__', false);

  await import('preact/debug');
  const { root } = await import('../../src/index');

  const a = { b: <view />, arr: [], obj: {}, regexp: /foo/ };

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
    [Error: Invalid type passed to createElement(): [object Object]

    Did you accidentally pass a JSX literal as JSX twice?

      let My#text = <__snapshot_a94a8_test_1 />;
      let vnode = <My#text />;

    This usually happens when you export a JSX literal and not the component.

      in #text
      in Bar
      in App
    ]
  `,
  );

  expect(() => root.render(<a.arr />)).toThrowErrorMatchingInlineSnapshot(
    `[Error: Invalid type passed to createElement(): array]`,
  );
  expect(() => root.render(<a.obj />)).toThrowErrorMatchingInlineSnapshot(
    `[Error: Invalid type passed to createElement(): [object Object]]`,
  );
  expect(() => root.render(<a.regexp />)).toThrowErrorMatchingInlineSnapshot(
    `[Error: Invalid type passed to createElement(): /foo/]`,
  );
});
