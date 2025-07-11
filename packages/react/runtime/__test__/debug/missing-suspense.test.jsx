import { expect, test, vi } from 'vitest';

test('preact/debug - Missing Suspense', async () => {
  vi.stubGlobal('__MAIN_THREAD__', false)
    .stubGlobal('__LEPUS__', false);

  await import('preact/debug');
  const { lazy, root } = await import('../../src/index');

  const Foo = lazy(() => Promise.reject({ default: 'Foo' }));

  function Bar(props) {
    return props.children;
  }

  function App() {
    return (
      <Bar>
        <Foo />
      </Bar>
    );
  }

  expect(() => root.render(<App />)).toThrowErrorMatchingInlineSnapshot(
    `[Error: Missing Suspense. The throwing component was: Lazy]`,
  );

  function Baz() {
    throw Promise.resolve('Baz');
  }

  expect(() => root.render(<Baz />)).toThrowErrorMatchingInlineSnapshot(
    `[Error: Missing Suspense. The throwing component was: Baz]`,
  );
});
