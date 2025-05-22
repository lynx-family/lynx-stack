/** @jsxImportSource ../lepus */

import { Component, createContext, Fragment } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { elementTree } from './utils/nativeMethod';
import { globalEnvManager } from './utils/envManager';
import { setupDocument } from '../src/document';
import { renderOpcodesInto } from '../src/opcodes';
import renderToString from '../src/renderToOpcodes';
import { setupPage, SnapshotInstance, snapshotInstanceManager } from '../src/snapshot';

describe('renderToOpcodes', () => {
  beforeAll(() => {
    globalEnvManager.switchToMainThread();
  });

  it('should render hello world', () => {
    expect(renderToString(function() {})).toMatchInlineSnapshot(`[]`);

    expect(
      renderToString(
        <view>
          <text className={`a`.toLowerCase()}>Hello World</text>
          {'hello world'}
        </view>,
      ),
    ).toMatchInlineSnapshot(`
      [
        0,
        {
          "children": undefined,
          "id": -3,
          "type": "__Card__:__snapshot_a94a8_test_1",
          "values": undefined,
        },
        2,
        "values",
        [
          "a",
        ],
        3,
        "hello world",
        1,
      ]
    `);
  });

  it('should render Component depth 1', () => {
    function App() {
      const [a, setA] = useState(111);
      useMemo(() => {
        setA(1000);
      }, []);
      return <view>{a}</view>;
    }
    expect(
      renderToString(
        <view>
          <text>Hello World</text>
          <App />
        </view>,
      ),
    ).toMatchInlineSnapshot(`
      [
        0,
        {
          "children": undefined,
          "id": -4,
          "type": "__Card__:__snapshot_a94a8_test_3",
          "values": undefined,
        },
        0,
        {
          "children": undefined,
          "id": -6,
          "type": "__Card__:__snapshot_a94a8_test_2",
          "values": undefined,
        },
        3,
        "1000",
        1,
        1,
      ]
    `);
  });

  it('should render Class Component depth 1', () => {
    class App extends Component {
      static getDerivedStateFromProps(props, state) {
        return { a: 1 };
      }
      render() {
        return <view>{this.state.a}</view>;
      }
    }
    expect(
      renderToString(
        <view>
          <text>Hello World</text>
          <App />
        </view>,
      ),
    ).toMatchInlineSnapshot(`
      [
        0,
        {
          "children": undefined,
          "id": -7,
          "type": "__Card__:__snapshot_a94a8_test_5",
          "values": undefined,
        },
        0,
        {
          "children": undefined,
          "id": -8,
          "type": "__Card__:__snapshot_a94a8_test_4",
          "values": undefined,
        },
        3,
        "1",
        1,
        1,
      ]
    `);
  });

  it('should render with attr', () => {
    function App() {
      return (
        <view key={Math.random()}>
          <text>Hello World</text>
          <raw-text text={'Hello World'.toLowerCase()} />
        </view>
      );
    }
    expect(renderToString(<App />)).toMatchInlineSnapshot(`
      [
        0,
        {
          "children": undefined,
          "id": -9,
          "type": "__Card__:__snapshot_a94a8_test_6",
          "values": undefined,
        },
        2,
        "values",
        [
          "hello world",
        ],
        1,
      ]
    `);
  });

  it('should render with empty value', () => {
    function App() {
      return (
        <view>
          <text>Hello World</text>
          {[false, '111', '']}
        </view>
      );
    }
    expect(renderToString(<App />)).toMatchInlineSnapshot(`
      [
        0,
        {
          "children": undefined,
          "id": -10,
          "type": "__Card__:__snapshot_a94a8_test_7",
          "values": undefined,
        },
        3,
        "111",
        1,
      ]
    `);
  });

  it('should render with top-level Fragment', () => {
    function App() {
      return (
        <Fragment>
          <view>
            <text>Hello World</text>
            {[false, '111', '']}
          </view>
        </Fragment>
      );
    }

    expect(renderToString(<App />)).toMatchInlineSnapshot(`
      [
        0,
        {
          "children": undefined,
          "id": -11,
          "type": "__Card__:__snapshot_a94a8_test_8",
          "values": undefined,
        },
        3,
        "111",
        1,
      ]
    `);
  });

  it('should render with Fragment', () => {
    expect(
      renderToString(
        <Fragment>
          <view>
            <text>Hello World</text>
            {[false, '111', '']}
          </view>
        </Fragment>,
      ),
    ).toMatchInlineSnapshot(`
      [
        0,
        {
          "children": undefined,
          "id": -12,
          "type": "__Card__:__snapshot_a94a8_test_9",
          "values": undefined,
        },
        3,
        "111",
        1,
      ]
    `);
  });

  it('should render with context', () => {
    const { Provider, Consumer } = createContext(11111);
    expect(
      renderToString(
        <view>
          <text>Hello World</text>
          <Consumer>{v => <text>{v}</text>}</Consumer>
        </view>,
      ),
    ).toMatchInlineSnapshot(`
      [
        0,
        {
          "children": undefined,
          "id": -13,
          "type": "__Card__:__snapshot_a94a8_test_10",
          "values": undefined,
        },
        0,
        {
          "children": undefined,
          "id": -14,
          "type": "__Card__:__snapshot_a94a8_test_11",
          "values": undefined,
        },
        3,
        "11111",
        1,
        1,
      ]
    `);

    expect(
      renderToString(
        <Provider value={12345}>
          <view>
            <text>Hello World</text>
            <Consumer>{v => <text>{v}</text>}</Consumer>
          </view>
        </Provider>,
      ),
    ).toMatchInlineSnapshot(`
      [
        0,
        {
          "children": undefined,
          "id": -15,
          "type": "__Card__:__snapshot_a94a8_test_12",
          "values": undefined,
        },
        0,
        {
          "children": undefined,
          "id": -16,
          "type": "__Card__:__snapshot_a94a8_test_13",
          "values": undefined,
        },
        3,
        "12345",
        1,
        1,
      ]
    `);
  });

  it('should throw when error occur', () => {
    function App() {
      undefined();
    }
    expect(
      () =>
        renderToString(
          <view>
            <text>Hello World</text>
            <App />
          </view>,
        ),
    ).toThrowErrorMatchingInlineSnapshot(`[TypeError: (void 0) is not a function]`);

    // renderToString will throw on Error without calling `options[DIFFED]`
    vi.mocked(console.profile).mockClear();
    vi.mocked(console.profileEnd).mockClear();
  });

  it('should throw when error occur - with ErrorBoundary ignored', () => {
    const f = vi.fn();
    class ErrorBoundary extends Component {
      componentDidCatch = f;
      render() {
        return this.props.children;
      }
    }

    function App() {
      undefined();
    }
    expect(
      () =>
        renderToString(
          <view>
            <text>Hello World</text>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </view>,
        ),
    ).toThrowErrorMatchingInlineSnapshot(`[TypeError: (void 0) is not a function]`);
    expect(f).toBeCalledTimes(0);

    class ErrorBoundary2 extends Component {
      static getDerivedStateFromError = f;
      render() {
        return this.props.children;
      }
    }

    expect(
      () =>
        renderToString(
          <view>
            <text>Hello World</text>
            <ErrorBoundary2>
              <App />
            </ErrorBoundary2>
          </view>,
        ),
    ).toThrowErrorMatchingInlineSnapshot(`[TypeError: (void 0) is not a function]`);
    expect(f).toBeCalledTimes(0);

    // renderToString will throw on Error without calling `options[DIFFED]`
    vi.mocked(console.profile).mockClear();
    vi.mocked(console.profileEnd).mockClear();
  });
});

describe('renderOpcodesInto', () => {
  /** @type {SnapshotInstance} */
  let scratch;

  beforeAll(() => {
    setupDocument();
  });

  beforeEach(() => {
    setupPage(__CreatePage('0', 0));
    scratch = document.createElement('root');
  });

  afterEach(() => {
    elementTree.clear();
    snapshotInstanceManager.clear();
  });

  it('should render hello world', () => {
    scratch.ensureElements();

    const opcodes = renderToString(
      <view>
        <text>Hello World</text>
      </view>,
    );

    renderOpcodesInto(opcodes, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="Hello World"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('should render attr', () => {
    scratch.ensureElements();

    const opcodes = renderToString(
      <view>
        <text>Hello World</text>
        <raw-text text={'Hello World'.toLowerCase()} />
      </view>,
    );

    renderOpcodesInto(opcodes, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="Hello World"
            />
          </text>
          <raw-text
            text="hello world"
          />
        </view>
      </page>
    `);
  });

  it('should render string', () => {
    scratch.ensureElements();

    const opcodes = renderToString(
      <view>
        <text>Hello World</text>
        {'aaaa'.toUpperCase()}
      </view>,
    );

    renderOpcodesInto(opcodes, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="Hello World"
            />
          </text>
          <wrapper>
            <raw-text
              text="AAAA"
            />
          </wrapper>
        </view>
      </page>
    `);
  });

  it('should render with multi-children', () => {
    scratch.ensureElements();

    const opcodes = renderToString(
      <view>
        <text>Hello World</text>
        {[<view>A</view>, <view>B</view>, <view>C</view>]}
      </view>,
    );

    renderOpcodesInto(opcodes, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="Hello World"
            />
          </text>
          <wrapper>
            <view>
              <raw-text
                text="A"
              />
            </view>
            <view>
              <raw-text
                text="B"
              />
            </view>
            <view>
              <raw-text
                text="C"
              />
            </view>
          </wrapper>
        </view>
      </page>
    `);
  });

  it('should render when jsx is reused', () => {
    scratch.ensureElements();

    const reuse = (
      <view>
        {
          <view>
            <text>Hello</text>
          </view>
        }
        <text>World</text>
      </view>
    );

    const opcodes = renderToString(
      <view>
        <text>Hello World</text>
        {[reuse, reuse]}
      </view>,
    );

    renderOpcodesInto(opcodes, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="Hello World"
            />
          </text>
          <wrapper>
            <view>
              <wrapper>
                <view>
                  <text>
                    <raw-text
                      text="Hello"
                    />
                  </text>
                </view>
              </wrapper>
              <text>
                <raw-text
                  text="World"
                />
              </text>
            </view>
            <view>
              <wrapper>
                <view>
                  <text>
                    <raw-text
                      text="Hello"
                    />
                  </text>
                </view>
              </wrapper>
              <text>
                <raw-text
                  text="World"
                />
              </text>
            </view>
          </wrapper>
        </view>
      </page>
    `);
  });

  it('should render component with ref', () => {
    scratch.ensureElements();

    function Counter({ ref, count: _ }) {
      expect(ref).toBe(undefined);
      return <view />;
    }

    const opcodes = renderToString(<Counter ref={vi.fn()} count={1} />);
    renderOpcodesInto(opcodes, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view />
      </page>
    `);
  });

  it('should render component with defaultProps', () => {
    scratch.ensureElements();

    function Counter({ count }) {
      expect(count).toBe(1);
      return <view />;
    }

    Counter.defaultProps = { count: 1 };

    const opcodes = renderToString(<Counter />);
    renderOpcodesInto(opcodes, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view />
      </page>
    `);
  });

  it('should render empty array', () => {
    scratch.ensureElements();

    renderOpcodesInto([], scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      />
    `);
  });
});

it('should compile @jsxImportSource', () => {
  expect(<view />).toBeInstanceOf(SnapshotInstance);
});

describe('createElement', () => {
  const s = { __dummy: 1 };

  it('key should not be accessible to developer', () => {
    function Key({ key }) {
      expect(key).toBe(undefined);
      return <view />;
    }

    const opcodes1 = renderToString(<Key key={1} {...s} />);
    expect(opcodes1).toMatchInlineSnapshot(`
      [
        0,
        {
          "children": undefined,
          "id": -44,
          "type": "__Card__:__snapshot_a94a8_test_30",
          "values": undefined,
        },
        1,
      ]
    `);
    const opcodes2 = renderToString(<Key {...s} key={1} />);
    expect(opcodes2).toMatchInlineSnapshot(`
      [
        0,
        {
          "children": undefined,
          "id": -45,
          "type": "__Card__:__snapshot_a94a8_test_30",
          "values": undefined,
        },
        1,
      ]
    `);
  });

  it('ref should not be accessible to developer', () => {
    function Key({ ref }) {
      expect(ref).toBe(undefined);
      return <view />;
    }

    const opcodes1 = renderToString(<Key key={1} {...s} ref={vi.fn()} />);
    expect(opcodes1).toMatchInlineSnapshot(`
      [
        0,
        {
          "children": undefined,
          "id": -46,
          "type": "__Card__:__snapshot_a94a8_test_31",
          "values": undefined,
        },
        1,
      ]
    `);
    const opcodes2 = renderToString(<Key {...s} key={1} ref={vi.fn()} />);
    expect(opcodes2).toMatchInlineSnapshot(`
      [
        0,
        {
          "children": undefined,
          "id": -47,
          "type": "__Card__:__snapshot_a94a8_test_31",
          "values": undefined,
        },
        1,
      ]
    `);
  });

  it('children can be pass as extra arguments (length > 3)', () => {
    function Key({ key, children }) {
      expect(children).toMatchInlineSnapshot(`
        [
          1,
          1,
        ]
      `);
      return <view />;
    }

    renderToString(<Key {...s} key={1}>{1}{1}</Key>);
  });

  it('children can be pass as extra arguments (length > 2)', () => {
    function Key({ key, children }) {
      expect(children).toMatchInlineSnapshot(`1`);
      return <view />;
    }

    renderToString(<Key {...s} key={1}>{1}</Key>);
  });

  it('should render component with defaultProps', () => {
    function Counter({ count }) {
      expect(count).toBe(1);
      return <view />;
    }

    Counter.defaultProps = { count: 1 };

    renderToString(<Counter {...s} key={1} />);
  });
});
