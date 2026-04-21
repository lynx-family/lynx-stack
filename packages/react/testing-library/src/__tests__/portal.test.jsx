// Spec for a proposed `createPortal` in ReactLynx.
//
// These tests document the expected behavior of `createPortal(children, container)`:
//   - `container` is a Lynx element handle (the value callback-refs receive, i.e. a RefProxy).
//   - Portal children render as children of `container` in the MT element tree,
//     not where the portal call appears in JSX.
//   - React tree (context / events) is preserved across the portal boundary,
//     so context reaches through and events bubble to the logical parent.
//
// There are TWO parallel describe blocks below, each with the same 9 cases:
//
//   A) "useRef + useEffect workaround" — runs today. Captures the mounted
//      element into `hostRef.current` without going through setState, then
//      copies it into state exactly once via useEffect. Verbose but stable.
//
//   B) "idiomatic ref={setState}" — the pattern React DOM developers actually
//      write, mirroring the React docs' Leaflet example. CURRENTLY SKIPPED
//      because it infinite-loops in the ReactLynx runtime: the BT snapshot
//      path re-applies the ref every render, setState sees a fresh RefProxy
//      every time, enqueues another render — `process()` never drains. The
//      ref-apply dedup PR on lynx-stack-3 fixes that; once it lands here,
//      flip `describe.skip` → `describe` and the block lights up alongside
//      the createPortal implementation.
//
// Keeping both blocks makes this file serve two roles at once:
//   - immediate value: the (A) block actually exercises createPortal today
//   - forward-compat guard: any regression in the dedup fix re-breaks (B)
import '@testing-library/jest-dom';
import { createContext, createPortal, createRef, useContext, useEffect, useRef, useState } from '@lynx-js/react';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '..';

// ---------------------------------------------------------------------------
// (A) useRef + useEffect — the stable workaround that runs today.
// ---------------------------------------------------------------------------
describe('createPortal (useRef + useEffect workaround)', () => {
  it.only('renders children under the target container, not at the call site', () => {
    function App() {
      const hostRef = useRef(null);
      const [host, setHost] = useState(null);
      useEffect(() => {
        setHost(hostRef.current);
      }, []);
      return (
        <view data-testid='root'>
          {/* TODO: how make it work for static snapshot? */}
          <view data-testid='host' ref={hostRef}>{null}</view>
          <text>sibling</text>
          {host && createPortal(<text data-testid='portaled'>hello</text>, host)}
        </view>
      );
    }

    const { container } = render(<App />);

    // Portal subtree should live under `host`, NOT next to `<text>sibling</text>`.
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="root"
        >
          <view
            data-testid="host"
            react-ref-2-0="1"
          >
            <text
              data-testid="portaled"
            >
              hello
            </text>
          </view>
          <text>
            sibling
          </text>
          <wrapper />
        </view>
      </page>
    `);
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
          <view ref={hostRef} />
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
          <view ref={hostRef} />
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
          <view ref={hostRef} />
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
          <view data-testid='a' ref={aHostRef} />
          <view data-testid='b' ref={bHostRef} />
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
      const hostRef = useRef(null);
      const [host, setHost] = useState(null);
      useEffect(() => {
        setHost(hostRef.current);
      }, []);
      return (
        <view>
          <view ref={hostRef} />
          <ThemeCtx.Provider value='dark'>
            {host && createPortal(<Leaf />, host)}
          </ThemeCtx.Provider>
        </view>
      );
    }

    const { queryByText } = render(<App />);
    // The portalled leaf must see the logical (React tree) provider,
    // not any context from the physical DOM/element parent.
    expect(queryByText('theme:dark')).toBeInTheDocument();
  });

  it('bubbles events through the React tree, not the element tree', () => {
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
          {/* Physical host is here, NOT wrapping the tap handler. */}
          <view ref={hostRef} />
          {/* Logical parent owns the handler. Portal child lives inside it in the React tree. */}
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
    // Handler defined on the logical React parent must fire, even though the
    // portaled view is a physical child of `host`, which is a sibling.
    expect(onTapInReactParent).toHaveBeenCalledTimes(1);
  });

  it('supports the third-party-slot pattern (Leaflet-style)', () => {
    // Simulates a command-style widget that owns a subtree and exposes one
    // of its internal elements back to React for content injection.
    let externalSlot = null;
    function useFakeWidget(containerRef) {
      const [slot, setSlot] = useState(null);
      useEffect(() => {
        if (!containerRef.current) return;
        // Pretend the widget created its own internal node and handed it back.
        // In a real widget this would be a MT element created via PAPI.
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
          <view data-testid='widget' ref={hostRef} />
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

// ---------------------------------------------------------------------------
// (B) Idiomatic `ref={setState}` — same 9 cases, written the React-DOM way.
// Skipped pending ref-apply dedup (see file header).
// ---------------------------------------------------------------------------
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

    // Portal subtree should live under `host`, NOT next to `<text>sibling</text>`.
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
    // The portalled leaf must see the logical (React tree) provider,
    // not any context from the physical DOM/element parent.
    expect(queryByText('theme:dark')).toBeInTheDocument();
  });

  it('bubbles events through the React tree, not the element tree', () => {
    const onTapInReactParent = vi.fn();
    const portaledRef = createRef();

    function App() {
      const [host, setHost] = useState(null);
      return (
        <view>
          {/* Physical host is here, NOT wrapping the tap handler. */}
          <view ref={setHost} />
          {/* Logical parent owns the handler. Portal child lives inside it in the React tree. */}
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
    // Handler defined on the logical React parent must fire, even though the
    // portaled view is a physical child of `host`, which is a sibling.
    expect(onTapInReactParent).toHaveBeenCalledTimes(1);
  });

  it('supports the third-party-slot pattern (Leaflet-style)', () => {
    // Simulates a command-style widget that owns a subtree and exposes one
    // of its internal elements back to React for content injection.
    let externalSlot = null;

    function App() {
      const [host, setHost] = useState(null);
      const [slot, setSlot] = useState(null);
      useEffect(() => {
        if (!host) return;
        // Pretend the widget created its own internal node and handed it back.
        // In a real widget this would be a MT element created via PAPI.
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
