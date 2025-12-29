import { expect, test, vi } from 'vitest';

test('preact/debug - this.setState in constructor', async () => {
  vi.stubGlobal('__MAIN_THREAD__', false)
    .stubGlobal('__LEPUS__', false);

  const consoleWarn = vi.spyOn(console, 'warn');
  await import('preact/debug');
  const { root, Component } = await import('../../src/index');

  class Bar extends Component {
    constructor(props) {
      super(props);

      this.setState({});
    }
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

  expect(consoleWarn).toBeCalledWith(
    `Calling "this.setState" inside the constructor of a component is a no-op and might be a bug in your application. Instead, set "this.state = {}" directly.

  in Bar
  in App
`,
  );
});
