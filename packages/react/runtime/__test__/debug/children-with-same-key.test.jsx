import { expect, test, vi } from 'vitest';

test('preact/debug - children with the same key attribute', async () => {
  vi.stubGlobal('__MAIN_THREAD__', false)
    .stubGlobal('__LEPUS__', false);

  const consoleError = vi.spyOn(console, 'error');

  await import('preact/debug');
  const { root } = await import('../../src/index');

  function Bar() {
    return (
      <>
        {Array.from({ length: 5 }).fill(1).map(i => <view key={i} />)}
      </>
    );
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

  root.render(<App />);

  expect(consoleError).toBeCalledWith(
    `Following component has two or more children with the same key attribute: "1". This may cause glitches and misbehavior in rendering process. Component: 

<Bar />

  in Bar
  in App
`,
  );
});
