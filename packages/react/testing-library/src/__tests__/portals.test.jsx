import '@testing-library/jest-dom';
import { createContext, createPortal, createRef, useContext, useEffect, useRef, useState } from '@lynx-js/react';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '..';
import { prettyFormatSnapshotPatch } from '../../../runtime/lib/snapshot/debug/formatPatch';

describe('createPortal (useRef + useEffect)', () => {
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
          <view ref={hostRef} />
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
          <view data-testid='host' ref={hostRef} bindtap={onTapInHost} />
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
});

describe('createPortal (idiomatic ref={setState})', () => {
  it('renders children under the target container, not at the call site', () => {
    function App() {
      const [host, setHost] = useState(null);
      return (
        <view data-testid='root'>
          <view data-testid='host' ref={setHost} />
          <text>sibling</text>
          {host && createPortal(
            <text data-testid='portaled'>
              {'dynamic 1 '}
              static
              {'dynamic 2 '}
            </text>,
            host,
          )}
        </view>
      );
    }

    const { container } = render(<App />);
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
              <wrapper>
                dynamic 1 
              </wrapper>
              static
              <wrapper>
                dynamic 2 
              </wrapper>
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
});

describe('createPortal cleanup ordering', () => {
  it('does not throw when portal container is removed before portaled children', () => {
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

    function App() {
      const [host, setHost] = useState(null);
      return (
        <>
          {<view ref={setHost}>{null}</view>}
          {host && createPortal(
            <text data-testid='portaled'>
              {'dynamic 1 '}
              static
              {'dynamic 2 '}
            </text>,
            host,
          )}
        </>
      );
    }

    const { container, unmount } = render(<App />);

    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          react-ref-2-0="1"
        >
          <text
            data-testid="portaled"
          >
            <wrapper>
              dynamic 1 
            </wrapper>
            static
            <wrapper>
              dynamic 2 
            </wrapper>
          </text>
        </view>
      </page>
    `);

    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
        [
          {
            "id": 2,
            "op": "CreateElement",
            "type": "__snapshot_73047_test_31",
          },
          {
            "id": 2,
            "op": "SetAttributes",
            "values": [
              1,
            ],
          },
          {
            "beforeId": null,
            "childId": 2,
            "op": "InsertBefore",
            "parentId": -1,
            "slotIndex": 0,
          },
          {
            "id": 3,
            "op": "CreateElement",
            "type": "__snapshot_73047_test_32",
          },
          {
            "id": 4,
            "op": "CreateElement",
            "type": null,
          },
          {
            "id": 4,
            "op": "SetAttributes",
            "values": [
              "dynamic 1 ",
            ],
          },
          {
            "beforeId": null,
            "childId": 4,
            "op": "InsertBefore",
            "parentId": 3,
            "slotIndex": 0,
          },
          {
            "id": 5,
            "op": "CreateElement",
            "type": null,
          },
          {
            "id": 5,
            "op": "SetAttributes",
            "values": [
              "dynamic 2 ",
            ],
          },
          {
            "beforeId": null,
            "childId": 5,
            "op": "InsertBefore",
            "parentId": 3,
            "slotIndex": 1,
          },
          {
            "beforeId": null,
            "childId": 3,
            "identifier": "[react-ref-2-0]",
            "op": "nodesRefInsertBefore",
          },
        ]
      `);
    }

    unmount();

    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[1][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
        [
          {
            "childId": 2,
            "op": "RemoveChild",
            "parentId": -1,
          },
          {
            "childId": 3,
            "identifier": "[react-ref-2-0]",
            "op": "nodesRefRemoveChild",
          },
        ]
      `);
    }

    expect(container).toMatchInlineSnapshot(`<page />`);
  });
});

// Ported from preact's `compat/test/browser/portals.test.jsx` on the
// `feat/portal-slot` branch — the `setShowHello` / `setShowWorld` case where
// the portal target host has normal toggleable children alongside a portaled
// child. Verifies that toggling the host's static children doesn't disturb
// the portaled content and that re-adding host children appends them after
// the existing portal content (preact's documented insert order).
describe('createPortal (preact parity)', () => {
  it('coexists with toggling host children — preserves portal content + append-after-portal order', () => {
    let setShowHello;
    let setShowWorld;
    function App() {
      const ref = useRef(null);
      const [refState, setRefState] = useState(null);
      const [showHello, _setShowHello] = useState(true);
      const [showWorld, _setShowWorld] = useState(true);
      setShowHello = _setShowHello;
      setShowWorld = _setShowWorld;
      useEffect(() => {
        if (ref.current) setRefState(ref.current);
      }, [ref.current]);
      return (
        <view>
          <view ref={ref}>
            {showHello && <text>Hello</text>}
            {showWorld && <text>World</text>}
          </view>
          {refState && createPortal(<text>foobar</text>, refState)}
        </view>
      );
    }

    const { container } = render(<App />);

    // Initial: Hello + World inside the host, then portaled foobar appended
    // at the end.
    const orderedTexts = () =>
      Array.from(container.querySelectorAll('text'))
        .map((t) => t.textContent.trim())
        .join(',');
    expect(orderedTexts()).toBe('Hello,World,foobar');

    expect(container).toMatchInlineSnapshot(`
      <page>
        <view>
          <view
            react-ref-2-0="1"
          >
            <text>
              Hello
            </text>
            <text>
              World
            </text>
            <text>
              foobar
            </text>
          </view>
          <wrapper />
        </view>
      </page>
    `);

    act(() => setShowHello(false));
    expect(orderedTexts()).toBe('World,foobar');

    act(() => setShowWorld(false));
    expect(orderedTexts()).toBe('foobar');

    // Re-adding hello: it appends AFTER the existing portaled foobar,
    // matching preact's insert order — portal content is "stuck" where it
    // was first inserted, normal children get appended at the tail.
    act(() => setShowHello(true));
    expect(orderedTexts()).toBe('foobar,Hello');

    act(() => setShowWorld(true));
    expect(orderedTexts()).toBe('foobar,Hello,World');

    // Final tree shape — portal `<text>foobar</text>` sits inside the
    // ref'd host view ahead of the toggled-back-on Hello/World siblings.
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view>
          <view
            react-ref-2-0="1"
          >
            <text>
              foobar
            </text>
            <text>
              Hello
            </text>
            <text>
              World
            </text>
          </view>
          <wrapper />
        </view>
      </page>
    `);
  });
});

describe('createPortal with list-item reuse', () => {
  it('should reuse removed list item', async () => {
    let setListVal;
    let initListVal = Array(6)
      .fill(0)
      .map((v, i) => i);

    const A = () => {
      return <text>hello</text>;
    };
    const Comp = () => {
      const [host, setHost] = useState(null);

      const [listVal, _setListVal] = useState(initListVal);
      setListVal = _setListVal;
      const showMask = true;

      return (
        <>
          <view data-testid='host' ref={setHost} />
          <view
            style={{
              width: '100vw',
              height: '100vh',
            }}
          >
            {
              <list
                style={{
                  width: '100%',
                  height: '100%',
                }}
                data-testid='list'
              >
                {listVal.map((v) => {
                  return (
                    <list-item item-key={`${v}`} key={v} full-span>
                      <text>Not portaled: {v}</text>
                      {host && createPortal(
                        <>
                          <view>
                            {showMask ? <text>{v}</text> : null}
                            {showMask ? <text>{v}</text> : null}
                          </view>
                          {/* This will generate `__DynamicPartSlot` part for testing the hydration behavior of slot is as expected */}
                          <view>
                            <A />
                          </view>
                        </>,
                        host,
                      )}
                    </list-item>
                  );
                })}
              </list>
            }
          </view>
        </>
      );
    };

    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

    const { container, getByTestId } = render(<Comp />);

    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="host"
          react-ref-2-0="1"
        >
          <view>
            <text>
              0
            </text>
            <text>
              0
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
          <view>
            <text>
              1
            </text>
            <text>
              1
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
          <view>
            <text>
              2
            </text>
            <text>
              2
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
          <view>
            <text>
              3
            </text>
            <text>
              3
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
          <view>
            <text>
              4
            </text>
            <text>
              4
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
          <view>
            <text>
              5
            </text>
            <text>
              5
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
        </view>
        <view
          style="width:100vw;height:100vh"
        >
          <list
            data-testid="list"
            style="width:100%;height:100%"
            update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_73047_test_41","item-key":"0","full-span":true},{"position":1,"type":"__snapshot_73047_test_41","item-key":"1","full-span":true},{"position":2,"type":"__snapshot_73047_test_41","item-key":"2","full-span":true},{"position":3,"type":"__snapshot_73047_test_41","item-key":"3","full-span":true},{"position":4,"type":"__snapshot_73047_test_41","item-key":"4","full-span":true},{"position":5,"type":"__snapshot_73047_test_41","item-key":"5","full-span":true}],"removeAction":[],"updateAction":[]}]"
          />
        </view>
      </page>
    `);
    const list = getByTestId('list');

    const uid0 = elementTree.enterListItemAtIndex(list, 0);
    const uid1 = elementTree.enterListItemAtIndex(list, 1);
    const uid2 = elementTree.enterListItemAtIndex(list, 2);
    const uid3 = elementTree.enterListItemAtIndex(list, 3);

    const listItem3 = list.children[3];
    expect(listItem3).toMatchInlineSnapshot(`
      <list-item
        full-span="true"
        item-key="3"
      >
        <text>
          Not portaled: 
          <wrapper>
            3
          </wrapper>
        </text>
        <wrapper />
      </list-item>
    `);

    elementTree.leaveListItem(list, uid0);
    const uid4 = elementTree.enterListItemAtIndex(list, 4);
    expect(uid4).toBe(uid0);

    elementTree.leaveListItem(list, uid1);
    const uid5 = elementTree.enterListItemAtIndex(list, 5);
    expect(uid5).toBe(uid1);

    const __RemoveElement = vi.spyOn(lynxTestingEnv.mainThread.globalThis, '__RemoveElement');

    // Remove the element 3
    act(() => {
      setListVal(initListVal.filter((x) => x !== 3));
    });

    // Item-key=3's Portal had 2 top-level children (the masked-text wrapper
    // and the `<A/>` wrapper), so unmounting the list-item drains them via
    // 2 `nodesRefRemoveChild` ops, each calling `__RemoveElement(host, …)`.
    expect(__RemoveElement).toHaveBeenCalledTimes(2);

    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="host"
          react-ref-2-0="1"
        >
          <view>
            <text>
              0
            </text>
            <text>
              0
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
          <view>
            <text>
              1
            </text>
            <text>
              1
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
          <view>
            <text>
              2
            </text>
            <text>
              2
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
          <view>
            <text>
              4
            </text>
            <text>
              4
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
          <view>
            <text>
              5
            </text>
            <text>
              5
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
        </view>
        <view
          style="width:100vw;height:100vh"
        >
          <list
            data-testid="list"
            style="width:100%;height:100%"
            update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_73047_test_41","item-key":"0","full-span":true},{"position":1,"type":"__snapshot_73047_test_41","item-key":"1","full-span":true},{"position":2,"type":"__snapshot_73047_test_41","item-key":"2","full-span":true},{"position":3,"type":"__snapshot_73047_test_41","item-key":"3","full-span":true},{"position":4,"type":"__snapshot_73047_test_41","item-key":"4","full-span":true},{"position":5,"type":"__snapshot_73047_test_41","item-key":"5","full-span":true}],"removeAction":[],"updateAction":[]},{"insertAction":[],"removeAction":[3],"updateAction":[]}]"
          >
            <list-item
              full-span="true"
              item-key="4"
            >
              <text>
                Not portaled: 
                <wrapper>
                  4
                </wrapper>
              </text>
              <wrapper />
            </list-item>
            <list-item
              full-span="true"
              item-key="5"
            >
              <text>
                Not portaled: 
                <wrapper>
                  5
                </wrapper>
              </text>
              <wrapper />
            </list-item>
            <list-item
              full-span="true"
              item-key="2"
            >
              <text>
                Not portaled: 
                <wrapper>
                  2
                </wrapper>
              </text>
              <wrapper />
            </list-item>
            <list-item
              full-span="true"
              item-key="3"
            >
              <text>
                Not portaled: 
                <wrapper>
                  3
                </wrapper>
              </text>
              <wrapper />
            </list-item>
          </list>
        </view>
      </page>
    `);

    const __CreateElement = vi.spyOn(lynxTestingEnv.mainThread.globalThis, '__CreateElement');
    const __SetAttribute = vi.spyOn(lynxTestingEnv.mainThread.globalThis, '__SetAttribute');
    const __FlushElementTree = vi.spyOn(lynxTestingEnv.mainThread.globalThis, '__FlushElementTree');

    // Remove action is generated
    expect(JSON.parse(list.getAttribute('update-list-info'))[1].removeAction)
      .toMatchInlineSnapshot(`
        [
          3,
        ]
      `);
    // Reuse the element 3
    elementTree.leaveListItem(list, uid3);
    elementTree.enterListItemAtIndex(list, 1);

    expect(__CreateElement).toHaveBeenCalledTimes(0);
    expect(__SetAttribute).toHaveBeenCalledTimes(3);
    // The original FiberElement of element 3 is reused for element 1 now
    expect(__SetAttribute.mock.calls[0][0]).toBe(listItem3);
    expect(__SetAttribute.mock.calls[0][0].$$uiSign).toBe(uid3);
    expect(listItem3).toMatchInlineSnapshot(`
      <list-item
        full-span="true"
        item-key="1"
      >
        <text>
          Not portaled: 
          <wrapper>
            1
          </wrapper>
        </text>
        <wrapper />
      </list-item>
    `);
    expect(__FlushElementTree).toHaveBeenCalledTimes(1);
  });
});

/**
 * Real `lynx.createSelectorQuery().select('#id')` (NOT a React ref) gives a
 * `NodesRef` whose `_nodeSelectToken.identifier` is the CSS selector. The
 * portal patch carries that selector across the bridge and main-thread
 * apply resolves it via `__QuerySelector`.
 *
 * Crucially, the host is owned by a different component than the one
 * calling `createPortal` — the producer doesn't need to thread a ref
 * down, the consumer just queries by id.
 *
 * The lookup runs after the first commit (main-thread elements only land
 * once `firstScreen` flushes the hydrate patch), so we trigger the
 * `setHost(select(...))` from outside via an exposed setter rather than
 * a synchronous `useEffect` — same pattern app code would use after
 * `firstScreen`.
 */
describe('createPortal with real lynx.createSelectorQuery', () => {
  it('portals across components via a CSS-selector NodesRef', () => {
    let setHostFromOutside;

    // Producer: renders the host element somewhere in the tree, addressable
    // purely by id. It doesn't thread any ref downward.
    function HostProvider() {
      return <view id='global-host' data-testid='host' />;
    }

    // Consumer: portals into whatever host the parent injects via state.
    function PortalConsumer({ host }) {
      return host
        ? createPortal(<text data-testid='portaled'>cross-component</text>, host)
        : null;
    }

    function App() {
      const [host, setHost] = useState(null);
      setHostFromOutside = setHost;
      return (
        <view>
          <HostProvider />
          <PortalConsumer host={host} />
        </view>
      );
    }

    const { getByTestId, queryByText } = render(<App />);

    // After the first commit, the host is in the main-thread DOM. Now look
    // it up by id and feed the resulting `NodesRef` to the portal.
    act(() => {
      setHostFromOutside(lynx.createSelectorQuery().select('#global-host'));
    });

    // The portaled `<text>` lives under the host element — confirming the
    // selector resolved correctly on the main thread.
    expect(queryByText('cross-component')).toBeInTheDocument();
    expect(getByTestId('host')).toContainElement(queryByText('cross-component'));
  });

  it('cleanly unmounts a selector-query portal', () => {
    let setShow, setHostFromOutside;
    function App() {
      const [show, _setShow] = useState(true);
      setShow = _setShow;
      const [host, _setHost] = useState(null);
      setHostFromOutside = _setHost;
      return (
        <view>
          <view id='unmount-host' data-testid='host' />
          {show && host && createPortal(<text>toggle-me</text>, host)}
        </view>
      );
    }

    const { queryByText } = render(<App />);

    act(() => {
      setHostFromOutside(lynx.createSelectorQuery().select('#unmount-host'));
    });
    expect(queryByText('toggle-me')).toBeInTheDocument();

    act(() => setShow(false));
    expect(queryByText('toggle-me')).not.toBeInTheDocument();
  });
});

describe('portal unmount', () => {
  it('unmounts a portal', () => {
    let setShow;
    const PortalConsumer = ({ host }) => {
      const [show, _setShow] = useState(true);
      setShow = _setShow;
      return show && host && createPortal(<text>toggle-me</text>, host);
    };
    const App = () => {
      const [host, setHost] = useState(null);
      return (
        <view>
          <view data-testid='host' ref={setHost} />
          <PortalConsumer host={host} />
        </view>
      );
    };
    const { queryByText } = render(<App />);
    expect(queryByText('toggle-me')).toBeInTheDocument();

    act(() => setShow(false));
    expect(queryByText('toggle-me')).not.toBeInTheDocument();
  });

  /**
   * Reproducer for the missing `unref` step in `applyNodesRefRemoveChild`:
   * a `main-thread:ref` callback worklet returns a cleanup function which is
   * stored on `worklet._unmount` at mount. Normal `SnapshotInstance.removeChild`
   * runs `unref(child, true)` and that fires the cleanup, but the portal-only
   * `nodesRefRemoveChild` apply path skips `unref` today, so portaled subtrees
   * leak the ref and never invoke the cleanup. This test asserts the cleanup
   * IS invoked on portal unmount; today it fails.
   */
  it('runs main-thread:ref cleanup when a portaled subtree is unmounted', () => {
    globalThis._portalRefMountCount = 0;
    globalThis._portalRefCleanupCount = 0;

    let setShow;
    const PortalConsumer = ({ host }) => {
      const [show, _setShow] = useState(true);
      setShow = _setShow;
      return show && host && createPortal(
        <view
          main-thread:ref={(el) => {
            'main thread';
            if (el) globalThis._portalRefMountCount += 1;
            return () => {
              'main thread';
              globalThis._portalRefCleanupCount += 1;
            };
          }}
        >
          <text>portaled-with-ref</text>
        </view>,
        host,
      );
    };
    const App = () => {
      const [host, setHost] = useState(null);
      return (
        <view>
          <view data-testid='host' ref={setHost} />
          <PortalConsumer host={host} />
        </view>
      );
    };

    const { queryByText } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });
    expect(queryByText('portaled-with-ref')).toBeInTheDocument();
    expect(globalThis._portalRefMountCount).toBe(1);
    expect(globalThis._portalRefCleanupCount).toBe(0);

    act(() => setShow(false));
    expect(queryByText('portaled-with-ref')).not.toBeInTheDocument();
    expect(globalThis._portalRefCleanupCount).toBe(1);
  });

  /**
   * Reproducer for the missing `snapshotDestroyList` step in
   * `applyNodesRefRemoveChild`: a portaled `<list>` registers itself in
   * `gSignMap` / `gRecycleMap` and installs native list callbacks on mount.
   * The regular `SnapshotInstance.removeChild` traversal calls
   * `snapshotDestroyList(v)` for list-holder nodes; the portal-only path
   * skipped that, so unmounting the portal would leak the native list
   * callbacks (`__UpdateListCallbacks` is the observable side-effect we
   * spy on here).
   */
  it('destroys portaled <list> native callbacks when the portal is unmounted', () => {
    const updateCallbacks = vi.spyOn(
      lynxTestingEnv.mainThread.globalThis,
      '__UpdateListCallbacks',
    );

    let setShow;
    const PortalConsumer = ({ host }) => {
      const [show, _setShow] = useState(true);
      setShow = _setShow;
      return show && host && createPortal(
        <list data-testid='portaled-list'>
          <list-item item-key='0' full-span>
            <text>item</text>
          </list-item>
        </list>,
        host,
      );
    };
    const App = () => {
      const [host, setHost] = useState(null);
      return (
        <view>
          <view data-testid='host' ref={setHost} />
          <PortalConsumer host={host} />
        </view>
      );
    };

    const { queryByTestId } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });
    expect(queryByTestId('portaled-list')).toBeInTheDocument();
    const callsAfterMount = updateCallbacks.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);

    act(() => setShow(false));
    expect(queryByTestId('portaled-list')).not.toBeInTheDocument();

    // After unmount, `snapshotDestroyList` must have run an additional
    // `__UpdateListCallbacks(list, () => -1, () => {}, () => {})` to detach
    // the native callbacks. Without the fix, this stays at `callsAfterMount`.
    expect(updateCallbacks.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });
});
