/** @jsxImportSource ../lepus */

import { Component, createContext, Fragment } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { elementTree, waitSchedule } from './utils/nativeMethod';
import { globalEnvManager } from './utils/envManager';
import { setupDocument } from '../src/document';
import { renderOpcodesInto } from '../src/opcodes';
import renderToString from '../src/renderToOpcodes';
import { setupPage, SnapshotInstance, snapshotInstanceManager } from '../src/snapshot';
import { createElement, cloneElement } from '../lepus';
import { Suspense } from 'preact/compat';
import { createSuspender } from './createSuspender';
import { __root } from '../src/root';

describe('renderToOpcodes', () => {
  beforeAll(() => {
    globalEnvManager.switchToMainThread();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render hello world', () => {
    expect(renderToString(function() {
    })).toMatchInlineSnapshot(`[]`);

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
          "extraProps": undefined,
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
          "extraProps": undefined,
          "id": -4,
          "type": "__Card__:__snapshot_a94a8_test_3",
          "values": undefined,
        },
        0,
        {
          "children": undefined,
          "extraProps": undefined,
          "id": -6,
          "type": "__Card__:__snapshot_a94a8_test_2",
          "values": undefined,
        },
        3,
        1000,
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
          "extraProps": undefined,
          "id": -7,
          "type": "__Card__:__snapshot_a94a8_test_5",
          "values": undefined,
        },
        0,
        {
          "children": undefined,
          "extraProps": undefined,
          "id": -8,
          "type": "__Card__:__snapshot_a94a8_test_4",
          "values": undefined,
        },
        3,
        1,
        1,
        1,
      ]
    `);
  });

  it('should render with attr', () => {
    const random = Math.random();

    function App() {
      return (
        <view random={random}>
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
          "extraProps": undefined,
          "id": -9,
          "type": "__Card__:__snapshot_a94a8_test_6",
          "values": undefined,
        },
        2,
        "values",
        [
          ${random},
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
          "extraProps": undefined,
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
          "extraProps": undefined,
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
          "extraProps": undefined,
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
          "extraProps": undefined,
          "id": -13,
          "type": "__Card__:__snapshot_a94a8_test_10",
          "values": undefined,
        },
        0,
        {
          "children": undefined,
          "extraProps": undefined,
          "id": -14,
          "type": "__Card__:__snapshot_a94a8_test_11",
          "values": undefined,
        },
        3,
        11111,
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
          "extraProps": undefined,
          "id": -15,
          "type": "__Card__:__snapshot_a94a8_test_12",
          "values": undefined,
        },
        0,
        {
          "children": undefined,
          "extraProps": undefined,
          "id": -16,
          "type": "__Card__:__snapshot_a94a8_test_13",
          "values": undefined,
        },
        3,
        12345,
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

  it('should render fallback when a direct child suspends', async () => {
    const { Suspender, suspended } = createSuspender();

    const fallbackJsx = <text>loading...</text>;

    const rendered = renderToString(
      <Suspense fallback={fallbackJsx}>
        <Suspender>
          <text className='foo'>bar</text>
        </Suspender>
      </Suspense>,
    );

    expect(rendered.length).toBe(3);
    expect(rendered[0]).toStrictEqual(0);
    expect(rendered[1].type).toStrictEqual(fallbackJsx.type);
    expect(rendered[2]).toStrictEqual(1);
  });

  it('should render fallback when suspended component is not a direct child', async () => {
    const { Suspender, suspended } = createSuspender();

    const fallbackJsx = <text>loading...</text>;

    const rendered = renderToString(
      <Suspense fallback={fallbackJsx}>
        <view attr={Math.random()}>
          <Suspender>
            <text className='foo'>bar</text>
          </Suspender>
        </view>
      </Suspense>,
    );

    expect(rendered.length).toBe(3);
    expect(rendered[0]).toStrictEqual(0);
    expect(rendered[1].type).toStrictEqual(fallbackJsx.type);
    expect(rendered[2]).toStrictEqual(1);
  });

  it('should render a fallback that is a Fragment', async () => {
    const { Suspender, suspended } = createSuspender();

    const fallbackJsx1 = <text>{`loading1...`}</text>;
    const fallbackJsx2 = <text>{`loading2...`}</text>;

    const fallbackJsx = (
      <>
        {fallbackJsx1}
        {fallbackJsx2}
      </>
    );

    const rendered = renderToString(
      <Suspense fallback={fallbackJsx}>
        <view attr={Math.random()}>
          <Suspender>
            <text className='foo'>bar</text>
          </Suspender>
        </view>
      </Suspense>,
    );

    expect(rendered[1].type).toStrictEqual(fallbackJsx1.type);
    expect(rendered[6].type).toStrictEqual(fallbackJsx2.type);
  });

  it('should render outer fallback when nested child suspends', async () => {
    const { Suspender: Suspender1, suspended: suspended1 } = createSuspender();
    const { Suspender: Suspender2, suspended: suspended2 } = createSuspender();

    const fallbackJsx1 = <text>loading1...</text>;
    const fallbackJsx2 = <text>loading2...</text>;

    const rendered = renderToString(
      <Suspense fallback={fallbackJsx1}>
        <view attr={Math.random()}>
          <Suspender1>
            <text className='foo'>bar</text>
            <Suspense fallback={fallbackJsx2}>
              <Suspender2>
                <text className='foo'>bar</text>
              </Suspender2>
            </Suspense>
          </Suspender1>
        </view>
      </Suspense>,
    );

    expect(rendered.length).toBe(3);
    expect(rendered[0]).toStrictEqual(0);
    expect(rendered[1].type).toStrictEqual(fallbackJsx1.type);
    expect(rendered[2]).toStrictEqual(1);
  });

  it('should render inner fallback and resolved content when outer suspense is resolved', async () => {
    const { Suspender: Suspender1, suspended: suspended1 } = createSuspender();
    const { Suspender: Suspender2, suspended: suspended2 } = createSuspender();
    suspended1.resolve();
    await waitSchedule();

    const fallbackJsx1 = <text>loading1...</text>;
    const fallbackJsx2 = <text>loading2...</text>;
    const resolvedJsx1 = <text className='foo'>bar</text>;
    const resolvedJsx2 = <text className='foo'>bar</text>;

    const rendered = renderToString(
      <Suspense fallback={fallbackJsx1}>
        <Suspender1>
          <>
            {resolvedJsx1}
            <Suspense fallback={fallbackJsx2}>
              <Suspender2>
                <text className='foo' attr={Math.random()}>bar</text>
              </Suspender2>
            </Suspense>
            {resolvedJsx2}
          </>
        </Suspender1>
      </Suspense>,
    );

    expect(rendered.length).toBe(9);
    expect(rendered[1].type).toStrictEqual(resolvedJsx1.type);
    expect(rendered[4].type).toStrictEqual(fallbackJsx2.type);
    expect(rendered[7].type).toStrictEqual(resolvedJsx2.type);
  });

  it('should render text with resolved suspense', async () => {
    const { Suspender, suspended } = createSuspender();
    suspended.resolve();
    await waitSchedule();

    const resolvedJsx = <text className='foo'>bar</text>;

    const rendered = renderToString(
      <Suspense fallback={<text>loading...</text>}>
        <Suspender>
          {resolvedJsx}
        </Suspender>
      </Suspense>,
    );

    expect(rendered.length).toBe(3);
    expect(rendered[0]).toStrictEqual(0);
    expect(rendered[1].type).toStrictEqual(resolvedJsx.type);
    expect(rendered[2]).toStrictEqual(1);
  });

  it('should render text with nested suspense', async () => {
    const { Suspender: Suspender1, suspended: suspended1 } = createSuspender();
    const { Suspender: Suspender2, suspended: suspended2 } = createSuspender();
    const { Suspender: Suspender3, suspended: suspended3 } = createSuspender();
    suspended1.resolve();
    suspended2.resolve();
    suspended3.resolve();
    await waitSchedule();

    const resolvedJsx1 = <text className='foo'>bar1</text>;
    const resolvedJsx2 = <text className='foo'>bar2</text>;
    const resolvedJsx3 = <text className='foo'>bar3</text>;
    const resolvedJsx4 = <text className='foo'>bar4</text>;
    const resolvedJsx5 = <text className='foo'>bar5</text>;

    const rendered = renderToString(
      <view>
        <Suspense fallback={<text>loading...</text>}>
          <Suspender1>
            {resolvedJsx1}
            <Suspense fallback={<text>loading...</text>}>
              <Suspender2>
                {resolvedJsx2}
                <Suspense fallback={<text>loading...</text>}>
                  <Suspender3>
                    {resolvedJsx3}
                  </Suspender3>
                </Suspense>
                {resolvedJsx4}
              </Suspender2>
            </Suspense>
            {resolvedJsx5}
          </Suspender1>
        </Suspense>
      </view>,
    );

    expect(rendered.length).toBe(18);
    expect(rendered[3].type).toStrictEqual(resolvedJsx1.type);
    expect(rendered[6].type).toStrictEqual(resolvedJsx2.type);
    expect(rendered[9].type).toStrictEqual(resolvedJsx3.type);
    expect(rendered[12].type).toStrictEqual(resolvedJsx4.type);
    expect(rendered[15].type).toStrictEqual(resolvedJsx5.type);
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

  it('opcodes will not ref FiberElement', () => {
    scratch.ensureElements();

    function Fragment({ children }) {
      return children;
    }

    const opcodes = renderToString(
      <view>
        <text>Hello World</text>
        {[
          <view>A</view>,
          <view>B</view>,
          <view>C</view>,
          <view>
            C
            <Fragment>
              <text>C1</text>
              <text>C2</text>
              <text>C3</text>
              <text>C4</text>
            </Fragment>
          </view>,
          <view>D{[<text>D1</text>, <text>D2</text>, <text>D3</text>, <text>D4</text>]}</view>,
        ]}
      </view>,
    );

    renderOpcodesInto(opcodes, scratch);

    scratch.__firstChild.removeChild(scratch.__firstChild.__firstChild);
    scratch.__firstChild.removeChild(scratch.__firstChild.__lastChild);
    scratch.__firstChild.removeChild(scratch.__firstChild.__lastChild);

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

    const [vnodeA, vnodeB, vnodeC, vnodeC2, vnodeD] = scratch.__firstChild.props.children;

    expect(vnodeA).not.toHaveProperty('__elements');
    expect(vnodeA).not.toHaveProperty('__element_root');
    expect(vnodeB).toHaveProperty('__elements');
    expect(vnodeB).toHaveProperty('__element_root');
    expect(vnodeC).toHaveProperty('__elements');
    expect(vnodeC).toHaveProperty('__element_root');
    expect(vnodeD).not.toHaveProperty('__elements');
    expect(vnodeD).not.toHaveProperty('__element_root');

    {
      const componentVNodeC = vnodeC2.props.children;
      expect(componentVNodeC.type).toBe(Fragment);
      expect(componentVNodeC.props.children).toHaveLength(4);
      // FIXME(hzy): there is still a cycle reference
      expect(componentVNodeC.__c.__v).toBe(componentVNodeC);
      componentVNodeC.props.children.forEach((vnode) => {
        expect(vnode).not.toHaveProperty('__elements');
        expect(vnode).not.toHaveProperty('__element_root');
      });
    }

    expect(vnodeD.props.children).toHaveLength(4);
    vnodeD.props.children.forEach((vnode) => {
      expect(vnode).not.toHaveProperty('__elements');
      expect(vnode).not.toHaveProperty('__element_root');
    });
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
          "extraProps": undefined,
          "id": -89,
          "type": "__Card__:__snapshot_a94a8_test_74",
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
          "extraProps": undefined,
          "id": -90,
          "type": "__Card__:__snapshot_a94a8_test_74",
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
          "extraProps": undefined,
          "id": -91,
          "type": "__Card__:__snapshot_a94a8_test_75",
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
          "extraProps": undefined,
          "id": -92,
          "type": "__Card__:__snapshot_a94a8_test_75",
          "values": undefined,
        },
        1,
      ]
    `);
  });

  it('children can be pass as extra arguments (length > 3)', () => {
    function Key({ key, children }) {
      expect(key).toBe(undefined);
      expect(children).toMatchInlineSnapshot(`
        [
          1,
          1,
        ]
      `);
      return <view />;
    }

    renderToString(createElement(Key, { key: 1 }, 1, 1));
  });

  it('children can be pass as extra arguments (length > 3) (JSX)', () => {
    function Key({ key, children }) {
      expect(key).toBe(undefined);
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

describe('cloneElement', () => {
  it('should clone component', () => {
    function Comp() {
    }

    const instance = <Comp prop1={1}>hello</Comp>;
    const clone = cloneElement(instance);

    // expect(clone.type).to.equal(instance.type);
    // expect(clone.props).not.to.equal(instance.props); // Should be a different object...
    // expect(clone.props).to.deep.equal(instance.props); // with the same properties

    expect(clone.type).toBe(instance.type);
    expect(clone.props).not.toBe(instance.props); // Should be a different object...
    expect(clone.props).toEqual(instance.props); // with the same properties
  });

  it('should merge new props', () => {
    function Foo() {
    }

    const instance = <Foo prop1={1} prop2={2} />;
    const clone = cloneElement(instance, { prop1: -1, newProp: -2 });

    expect(clone.type).toBe(instance.type);
    expect(clone.props).not.toBe(instance.props);
    expect(clone.props).not.toEqual(instance.props);
    expect(clone.props.prop1).toBe(-1);
    expect(clone.props.prop2).toBe(2);
    expect(clone.props.newProp).toBe(-2);
  });

  it('should override children if specified', () => {
    function Foo() {
    }

    const instance = <Foo>hello</Foo>;
    const clone = cloneElement(instance, null, 'world', '!');

    expect(clone.type).toBe(instance.type);
    expect(clone.props).not.toBe(instance.props);
    expect(clone.props.children).toEqual(['world', '!']);
  });

  it('should override children if null is provided as an argument', () => {
    function Foo() {
    }

    const instance = <Foo>hello</Foo>;
    const clone = cloneElement(instance, { children: 'bar' }, null);

    expect(clone.type).toBe(instance.type);
    expect(clone.props).not.toBe(instance.props);
    expect(clone.props.children).toBeNull();
  });

  it('should override key if specified', () => {
    function Foo() {
    }

    const instance = <Foo key='1'>hello</Foo>;

    let clone = cloneElement(instance);
    // key is omit in lepus vnode
    // expect(clone.key).toBe('1');

    clone = cloneElement(instance, { key: '2' });
    // key is omit in lepus vnode
    // expect(clone.key).toBe('2');
  });

  it('should override ref if specified', () => {
    function a() {
    }

    function b() {
    }

    function Foo() {
    }

    const instance = <Foo ref={a}>hello</Foo>;

    let clone = cloneElement(instance);
    // ref is omit in lepus vnode
    // expect(clone.ref).toBe(a);

    clone = cloneElement(instance, { ref: b });
    // ref is omit in lepus vnode
    // expect(clone.ref).toBe(b);
  });

  it('should prevent undefined properties from overriding default props', () => {
    class Example extends Component {
      render(props) {
        return <div style={{ color: props.color }}>thing</div>;
      }
    }

    Example.defaultProps = { color: 'blue' };

    const element = <Example color='red' />;
    const clone = cloneElement(element, { color: undefined });
    expect(clone.props.color).toBe('blue');
  });
});

describe('renderMainThread', () => {
  it('should not throw if error - instead it will render an empty page', () => {
    function App() {
      undefined();
    }

    __root.__jsx = (
      <view>
        <text>Hello World</text>
        <App />
      </view>
    );

    expect(() => renderPage()).not.toThrow();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      />
    `);
  });
});
