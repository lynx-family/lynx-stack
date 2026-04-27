// (A) useRef+useEffect workaround — runs today.
// (B) idiomatic ref={setState} — skipped until ref-apply dedup lands.
import '@testing-library/jest-dom';
import { createContext, createPortal, createPortalMainThread, createRef, useContext, useEffect, useRef, useState } from '@lynx-js/react';
import { __root } from '@lynx-js/react/internal';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '..';

describe('createPortal without `portal-container`', () => {
  it('throws when the container snapshot has no empty slot at element_index 0', () => {
    const hostRef = createRef();
    render(<view ref={hostRef} />);

    expect(() => createPortal(<text>boom</text>, hostRef.current))
      .toThrowErrorMatchingInlineSnapshot(
        `[Error: createPortal container is not valid: snapshot type __snapshot_0d4c7_test_1 must have a single empty slot at element index 0. Mark the container element with the \`portal-container\` attribute, e.g. \`<view portal-container ref={hostRef} />\`.]`,
      );
  });
});

describe('createPortal (useRef + useEffect workaround)', () => {
  it('renders children under the target container, not at the call site', () => {
    function App() {
      const hostRef = useRef(null);
      const [host, setHost] = useState(null);
      useEffect(() => {
        setHost(hostRef.current);
      }, []);
      return (
        <view data-testid='root'>
          <view data-testid='host' ref={hostRef} portal-container />
          <text>sibling</text>
          {host && createPortal(<text data-testid='portaled'>hello</text>, host)}
        </view>
      );
    }

    const { container, getByTestId } = render(<App />);

    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="root"
        >
          <wrapper>
            <view
              data-testid="host"
              react-ref-3-0="1"
            >
              <text
                data-testid="portaled"
              >
                hello
              </text>
            </view>
          </wrapper>
          <text>
            sibling
          </text>
          <wrapper />
        </view>
      </page>
    `);

    const portaled = getByTestId('portaled');
    expect(portaled).toBeInTheDocument();
    expect(portaled).toHaveTextContent('hello');
    expect(portaled.parentElement).toBe(getByTestId('host'));
  });

  it('mounts/unmounts when the portal call is toggled', () => {
    let setShow;
    function App() {
      const hostRef = useRef(null);
      const [host, setHost] = useState(null);
      const [show, _setShow] = useState(true);
      setShow = _setShow;
      useEffect(() => {
        setHost(hostRef.current);
      }, []);
      return (
        <view>
          <view ref={hostRef} portal-container />
          {host && show && createPortal(<text>only-when-shown</text>, host)}
        </view>
      );
    }

    const { queryByText } = render(<App />);
    expect(queryByText('only-when-shown')).toBeInTheDocument();

    act(() => setShow(false));
    expect(queryByText('only-when-shown')).not.toBeInTheDocument();

    act(() => setShow(true));
    expect(queryByText('only-when-shown')).toBeInTheDocument();
  });

  it('re-renders when state inside the portalled subtree changes', () => {
    let bump;
    function Counter() {
      const [n, setN] = useState(0);
      bump = () => setN(v => v + 1);
      return <text>{`count:${n}`}</text>;
    }
    function App() {
      const hostRef = useRef(null);
      const [host, setHost] = useState(null);
      useEffect(() => {
        setHost(hostRef.current);
      }, []);
      return (
        <view>
          <view ref={hostRef} portal-container />
          {host && createPortal(<Counter />, host)}
        </view>
      );
    }

    const { queryByText } = render(<App />);
    expect(queryByText('count:0')).toBeInTheDocument();

    act(() => bump());
    expect(queryByText('count:1')).toBeInTheDocument();

    act(() => bump());
    expect(queryByText('count:2')).toBeInTheDocument();
  });

  it('removes portal children and fires cleanup on unmount', () => {
    const cleanup = vi.fn();
    function Child() {
      useEffect(() => cleanup, []);
      return <text>child</text>;
    }

    let setShow;
    function App() {
      const hostRef = useRef(null);
      const [host, setHost] = useState(null);
      const [show, _setShow] = useState(true);
      setShow = _setShow;
      useEffect(() => {
        setHost(hostRef.current);
      }, []);
      return (
        <view>
          <view ref={hostRef} portal-container />
          {show && host && createPortal(<Child />, host)}
        </view>
      );
    }

    const { queryByText } = render(<App />);
    expect(queryByText('child')).toBeInTheDocument();
    expect(cleanup).not.toHaveBeenCalled();

    act(() => setShow(false));
    expect(queryByText('child')).not.toBeInTheDocument();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('moves children when the target container changes', () => {
    let swap;
    function App() {
      const aHostRef = useRef(null);
      const bHostRef = useRef(null);
      const [aHost, setAHost] = useState(null);
      const [bHost, setBHost] = useState(null);
      const [useB, setUseB] = useState(false);
      swap = () => setUseB(true);
      useEffect(() => {
        setAHost(aHostRef.current);
        setBHost(bHostRef.current);
      }, []);
      const target = useB ? bHost : aHost;
      return (
        <view>
          <view data-testid='a' ref={aHostRef} portal-container />
          <view data-testid='b' ref={bHostRef} portal-container />
          {target && createPortal(<text data-testid='p'>movable</text>, target)}
        </view>
      );
    }

    const { getByTestId } = render(<App />);
    expect(getByTestId('a')).toContainElement(getByTestId('p'));
    expect(getByTestId('b')).not.toContainElement(getByTestId('p'));

    act(() => swap());
    expect(getByTestId('b')).toContainElement(getByTestId('p'));
    expect(getByTestId('a')).not.toContainElement(getByTestId('p'));
  });

  it('forwards context across the portal boundary', () => {
    const ThemeCtx = createContext('light');

    function Leaf() {
      const theme = useContext(ThemeCtx);
      return <text>{`theme:${theme}`}</text>;
    }

    function App() {
      const hostRef = useRef(null);
      const [host, setHost] = useState(null);
      useEffect(() => {
        setHost(hostRef.current);
      }, []);
      return (
        <view>
          <view ref={hostRef} portal-container />
          <ThemeCtx.Provider value='dark'>
            {host && createPortal(<Leaf />, host)}
          </ThemeCtx.Provider>
        </view>
      );
    }

    const { queryByText } = render(<App />);
    expect(queryByText('theme:dark')).toBeInTheDocument();
  });

  // preact has no ReactDOM-style synthetic event system, so events do not
  // bubble through the React tree across the portal boundary.
  it('does NOT bubble events through the React tree across the portal boundary', () => {
    const onTapInReactParent = vi.fn();
    const portaledRef = createRef();

    function App() {
      const hostRef = useRef(null);
      const [host, setHost] = useState(null);
      useEffect(() => {
        setHost(hostRef.current);
      }, []);
      return (
        <view>
          <view ref={hostRef} portal-container />
          <view bindtap={onTapInReactParent}>
            {host && createPortal(
              <view ref={portaledRef} data-testid='portaled' />,
              host,
            )}
          </view>
        </view>
      );
    }

    render(<App />);
    fireEvent.tap(portaledRef.current);
    expect(onTapInReactParent).not.toHaveBeenCalled();
  });

  it('bubbles events to the physical host element in the element tree', () => {
    const onTapInHost = vi.fn();
    const portaledRef = createRef();

    function App() {
      const hostRef = useRef(null);
      const [host, setHost] = useState(null);
      useEffect(() => {
        setHost(hostRef.current);
      }, []);
      return (
        <view>
          <view data-testid='host' ref={hostRef} bindtap={onTapInHost} portal-container />
          {host && createPortal(
            <view ref={portaledRef} data-testid='portaled' />,
            host,
          )}
        </view>
      );
    }

    const { getByTestId } = render(<App />);
    expect(getByTestId('portaled').parentElement).toBe(getByTestId('host'));

    // `fireEvent.tap` defaults to non-bubbling; dispatch directly instead.
    getByTestId('portaled').dispatchEvent(
      new Event('bindEvent:tap', { bubbles: true }),
    );
    expect(onTapInHost).toHaveBeenCalledTimes(1);
  });

  it('supports the third-party-slot pattern (Leaflet-style)', () => {
    let externalSlot = null;
    function useFakeWidget(containerRef) {
      const [slot, setSlot] = useState(null);
      useEffect(() => {
        if (!containerRef.current) return;
        externalSlot = containerRef.current;
        setSlot(containerRef.current);
      }, [containerRef.current]);
      return slot;
    }

    function App() {
      const hostRef = useRef(null);
      const slot = useFakeWidget(hostRef);
      return (
        <view>
          <view data-testid='widget' ref={hostRef} portal-container />
          {slot && createPortal(<text>injected</text>, slot)}
        </view>
      );
    }

    const { queryByText, getByTestId } = render(<App />);
    expect(queryByText('injected')).toBeInTheDocument();
    expect(getByTestId('widget')).toContainElement(queryByText('injected'));
    expect(externalSlot).not.toBeNull();
  });
});

describe('createPortal with `__root` as container', () => {
  it('IFR works', () => {
    function Child() {
      return <text data-testid='portaled'>hello-root</text>;
    }

    function App() {
      return (
        <view data-testid='host'>
          <text>sibling</text>
          {(__MAIN_THREAD__ ? createPortalMainThread : createPortal)(<Child />, __root)}
        </view>
      );
    }

    debugger;
    const { container, getByTestId } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: false
    });


    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="host"
        >
          <text>
            sibling
          </text>
          <wrapper />
        </view>
        <text
          data-testid="portaled"
        >
          hello-root
        </text>
      </page>
    `)

    expect(getByTestId('portaled')).toBeInTheDocument();
    expect(getByTestId('portaled')).toHaveTextContent('hello-root');
    // Portal child ends up under <page> directly, not inside <view data-testid="host">.
    expect(getByTestId('host')).not.toContainElement(getByTestId('portaled'));
    expect(container).toContainElement(getByTestId('portaled'));
    expect(getByTestId('portaled').parentElement).toBe(container);
  });

  it('BTS works', () => {
    function Child() {
      return <text data-testid='portaled'>hello-root</text>;
    }

    function App() {
      return (
        <view data-testid='host'>
          <text>sibling</text>
          {createPortal(<Child />, __root)}
        </view>
      );
    }

    const { container, getByTestId } = render(<App />, {
      enableMainThread: false,
      enableBackgroundThread: true
    });

    expect(container).toMatchInlineSnapshot(`
      <page>
        <text
          data-testid="portaled"
        >
          hello-root
        </text>
        <view
          data-testid="host"
        >
          <text>
            sibling
          </text>
          <wrapper />
        </view>
      </page>
    `)

    expect(getByTestId('portaled')).toBeInTheDocument();
    expect(getByTestId('portaled')).toHaveTextContent('hello-root');
    // Portal child ends up under <page> directly, not inside <view data-testid="host">.
    expect(getByTestId('host')).not.toContainElement(getByTestId('portaled'));
    expect(container).toContainElement(getByTestId('portaled'));
    expect(getByTestId('portaled').parentElement).toBe(container);
  });

  it('mounts/unmounts when the portal call is toggled', () => {
    let setShow;
    function App() {
      const [show, _setShow] = useState(true);
      setShow = _setShow;
      return (
        <view>
          {show && createPortal(<text>root-portal-shown</text>, __root)}
        </view>
      );
    }

    const { queryByText } = render(<App />);
    expect(queryByText('root-portal-shown')).toBeInTheDocument();

    act(() => setShow(false));
    expect(queryByText('root-portal-shown')).not.toBeInTheDocument();

    act(() => setShow(true));
    expect(queryByText('root-portal-shown')).toBeInTheDocument();
  });

  it('re-renders when state inside the portalled subtree changes', () => {
    let bump;
    function Counter() {
      const [n, setN] = useState(0);
      bump = () => setN(v => v + 1);
      return <text>{`root-count:${n}`}</text>;
    }
    function App() {
      return (
        <view>
          {createPortal(<Counter />, __root)}
        </view>
      );
    }

    const { queryByText } = render(<App />);
    expect(queryByText('root-count:0')).toBeInTheDocument();

    act(() => bump());
    expect(queryByText('root-count:1')).toBeInTheDocument();
  });
});

describe.skip('createPortal (idiomatic ref={setState})', () => {
  it('renders children under the target container, not at the call site', () => {
    function App() {
      const [host, setHost] = useState(null);
      return (
        <view data-testid='root'>
          <view data-testid='host' ref={setHost} />
          <text>sibling</text>
          {host && createPortal(<text data-testid='portaled'>hello</text>, host)}
        </view>
      );
    }

    const { container } = render(<App />);
    expect(container).toMatchInlineSnapshot();
  });

  it('mounts/unmounts when the portal call is toggled', () => {
    let setShow;
    function App() {
      const [host, setHost] = useState(null);
      const [show, _setShow] = useState(true);
      setShow = _setShow;
      return (
        <view>
          <view ref={setHost} />
          {host && show && createPortal(<text>only-when-shown</text>, host)}
        </view>
      );
    }

    const { queryByText } = render(<App />);
    expect(queryByText('only-when-shown')).toBeInTheDocument();

    act(() => setShow(false));
    expect(queryByText('only-when-shown')).not.toBeInTheDocument();

    act(() => setShow(true));
    expect(queryByText('only-when-shown')).toBeInTheDocument();
  });

  it('re-renders when state inside the portalled subtree changes', () => {
    let bump;
    function Counter() {
      const [n, setN] = useState(0);
      bump = () => setN(v => v + 1);
      return <text>{`count:${n}`}</text>;
    }
    function App() {
      const [host, setHost] = useState(null);
      return (
        <view>
          <view ref={setHost} />
          {host && createPortal(<Counter />, host)}
        </view>
      );
    }

    const { queryByText } = render(<App />);
    expect(queryByText('count:0')).toBeInTheDocument();

    act(() => bump());
    expect(queryByText('count:1')).toBeInTheDocument();

    act(() => bump());
    expect(queryByText('count:2')).toBeInTheDocument();
  });

  it('removes portal children and fires cleanup on unmount', () => {
    const cleanup = vi.fn();
    function Child() {
      useEffect(() => cleanup, []);
      return <text>child</text>;
    }

    let setShow;
    function App() {
      const [host, setHost] = useState(null);
      const [show, _setShow] = useState(true);
      setShow = _setShow;
      return (
        <view>
          <view ref={setHost} />
          {show && host && createPortal(<Child />, host)}
        </view>
      );
    }

    const { queryByText } = render(<App />);
    expect(queryByText('child')).toBeInTheDocument();
    expect(cleanup).not.toHaveBeenCalled();

    act(() => setShow(false));
    expect(queryByText('child')).not.toBeInTheDocument();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('moves children when the target container changes', () => {
    let swap;
    function App() {
      const [aHost, setAHost] = useState(null);
      const [bHost, setBHost] = useState(null);
      const [useB, setUseB] = useState(false);
      swap = () => setUseB(true);
      const target = useB ? bHost : aHost;
      return (
        <view>
          <view data-testid='a' ref={setAHost} />
          <view data-testid='b' ref={setBHost} />
          {target && createPortal(<text data-testid='p'>movable</text>, target)}
        </view>
      );
    }

    const { getByTestId } = render(<App />);
    expect(getByTestId('a')).toContainElement(getByTestId('p'));
    expect(getByTestId('b')).not.toContainElement(getByTestId('p'));

    act(() => swap());
    expect(getByTestId('b')).toContainElement(getByTestId('p'));
    expect(getByTestId('a')).not.toContainElement(getByTestId('p'));
  });

  it('renders nothing when container is null', () => {
    function App() {
      return (
        <view>
          <text>visible</text>
          {createPortal(<text>should-not-appear</text>, null)}
        </view>
      );
    }

    const { queryByText } = render(<App />);
    expect(queryByText('visible')).toBeInTheDocument();
    expect(queryByText('should-not-appear')).not.toBeInTheDocument();
  });

  it('forwards context across the portal boundary', () => {
    const ThemeCtx = createContext('light');

    function Leaf() {
      const theme = useContext(ThemeCtx);
      return <text>{`theme:${theme}`}</text>;
    }

    function App() {
      const [host, setHost] = useState(null);
      return (
        <view>
          <view ref={setHost} />
          <ThemeCtx.Provider value='dark'>
            {host && createPortal(<Leaf />, host)}
          </ThemeCtx.Provider>
        </view>
      );
    }

    const { queryByText } = render(<App />);
    expect(queryByText('theme:dark')).toBeInTheDocument();
  });

  it('bubbles events through the React tree, not the element tree', () => {
    const onTapInReactParent = vi.fn();
    const portaledRef = createRef();

    function App() {
      const [host, setHost] = useState(null);
      return (
        <view>
          <view ref={setHost} />
          <view bindtap={onTapInReactParent}>
            {host && createPortal(
              <view ref={portaledRef} data-testid='portaled' />,
              host,
            )}
          </view>
        </view>
      );
    }

    render(<App />);
    fireEvent.tap(portaledRef.current);
    expect(onTapInReactParent).toHaveBeenCalledTimes(1);
  });

  it('supports the third-party-slot pattern (Leaflet-style)', () => {
    let externalSlot = null;

    function App() {
      const [host, setHost] = useState(null);
      const [slot, setSlot] = useState(null);
      useEffect(() => {
        if (!host) return;
        externalSlot = host;
        setSlot(host);
      }, [host]);
      return (
        <view>
          <view data-testid='widget' ref={setHost} />
          {slot && createPortal(<text>injected</text>, slot)}
        </view>
      );
    }

    const { queryByText, getByTestId } = render(<App />);
    expect(queryByText('injected')).toBeInTheDocument();
    expect(getByTestId('widget')).toContainElement(queryByText('injected'));
    expect(externalSlot).not.toBeNull();
  });
});
