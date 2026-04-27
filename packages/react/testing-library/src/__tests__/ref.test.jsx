import { createRef, Component, useState, useEffect, useRef } from '@lynx-js/react';
import { render } from '..';
import { expect, vi, describe, it } from 'vitest';
import { act } from 'preact/test-utils';

describe('component ref', () => {
  it('basic', async () => {
    const cleanup = vi.fn();
    const ref1 = vi.fn(() => {
      return cleanup;
    });
    const ref2 = createRef();
    const ref3 = vi.fn();
    const ref4 = createRef();
    let _setShow;

    class Child extends Component {
      name = 'child';
      render() {
        return <view />;
      }
    }

    function App() {
      const [show, setShow] = useState(true);
      _setShow = setShow;

      return <Comp show={show} />;
    }

    class Comp extends Component {
      name = 'comp';
      render() {
        return this.props.show && (
          <view>
            <Child ref={ref1} />
            <Child ref={ref2} />
            <view ref={ref3} />
            <view ref={ref4} />
          </view>
        );
      }
    }

    render(<App />);
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <view>
          <wrapper>
            <view />
            <view />
          </wrapper>
          <view
            react-ref-2-0="1"
          />
          <view
            react-ref-2-1="1"
          />
        </view>
      </page>
    `);
    expect(ref1).toBeCalledWith(expect.objectContaining({
      name: 'child',
    }));
    expect(ref2.current).toHaveProperty('name', 'child');
    expect(ref3.mock.calls).toMatchInlineSnapshot(`
      [
        [
          RefProxy {
            "refAttr": [
              2,
              0,
            ],
            "task": undefined,
          },
        ],
      ]
    `);
    expect(ref4.current).toMatchInlineSnapshot(`
      RefProxy {
        "refAttr": [
          2,
          1,
        ],
        "task": undefined,
      }
    `);
    expect(cleanup).toBeCalledTimes(0);
    act(() => {
      _setShow(false);
    });
    expect(cleanup).toBeCalledTimes(1);
    expect(cleanup.mock.calls).toMatchInlineSnapshot(`
      [
        [],
      ]
    `);
    expect(ref3).toHaveBeenCalledWith(null);
    expect(ref4.current).toBeNull();
  });
});

describe('element ref', () => {
  it('basic', async () => {
    const ref1 = vi.fn();
    const ref2 = createRef();

    class Comp extends Component {
      name = 'comp';
      render() {
        return (
          <view>
            <view ref={ref1} />
            <view ref={ref2} />
          </view>
        );
      }
    }
    render(<Comp />);
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <view>
          <view
            react-ref-2-0="1"
          />
          <view
            react-ref-2-1="1"
          />
        </view>
      </page>
    `);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          RefProxy {
            "refAttr": [
              2,
              0,
            ],
            "task": undefined,
          },
        ],
      ]
    `);
    expect(ref2.current).toMatchInlineSnapshot(`
      RefProxy {
        "refAttr": [
          2,
          1,
        ],
        "task": undefined,
      }
    `);
  });

  it('insert', async () => {
    const ref1 = vi.fn();
    const ref2 = createRef();
    let _setShow;

    function App() {
      const [show, setShow] = useState(false);
      _setShow = setShow;
      return <Comp show={show} />;
    }
    class Comp extends Component {
      name = 'comp';
      render() {
        return this.props.show && (
          <view>
            <view ref={ref1} />
            <view ref={ref2} />
          </view>
        );
      }
    }
    render(<App />);
    expect(elementTree).toMatchInlineSnapshot(`<page />`);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`[]`);
    expect(ref2.current).toBeNull();
    act(() => {
      _setShow(true);
    });
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <view>
          <view
            react-ref-2-0="1"
          />
          <view
            react-ref-2-1="1"
          />
        </view>
      </page>
    `);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          RefProxy {
            "refAttr": [
              2,
              0,
            ],
            "task": undefined,
          },
        ],
      ]
    `);
    expect(ref2.current).toMatchInlineSnapshot(`
      RefProxy {
        "refAttr": [
          2,
          1,
        ],
        "task": undefined,
      }
    `);
  });

  it('remove', async () => {
    const ref1 = vi.fn();
    const ref2 = createRef();
    let _setShow;

    function App() {
      const [show, setShow] = useState(true);
      _setShow = setShow;
      return <Comp show={show} />;
    }

    class Comp extends Component {
      name = 'comp';
      render() {
        return this.props.show && (
          <view>
            <view ref={ref1} />
            <view ref={ref2} />
          </view>
        );
      }
    }
    render(<App />);
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <view>
          <view
            react-ref-2-0="1"
          />
          <view
            react-ref-2-1="1"
          />
        </view>
      </page>
    `);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          RefProxy {
            "refAttr": [
              2,
              0,
            ],
            "task": undefined,
          },
        ],
      ]
    `);
    expect(ref2.current).toMatchInlineSnapshot(`
      RefProxy {
        "refAttr": [
          2,
          1,
        ],
        "task": undefined,
      }
    `);
    act(() => {
      _setShow(false);
    });
    expect(elementTree).toMatchInlineSnapshot(`<page />`);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          RefProxy {
            "refAttr": [
              2,
              0,
            ],
            "task": undefined,
          },
        ],
        [
          null,
        ],
      ]
    `);
    expect(ref2.current).toBeNull();
  });

  it('remove with cleanup function', async () => {
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(0);

    const cleanup = vi.fn();
    const ref1 = vi.fn(() => {
      return cleanup;
    });
    let _setShow;

    function App() {
      const [show, setShow] = useState(true);
      _setShow = setShow;
      return <Comp show={show} />;
    }

    class Comp extends Component {
      name = 'comp';
      render() {
        return this.props.show && (
          <view>
            <view ref={ref1} />
          </view>
        );
      }
    }
    render(<App />);
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <view>
          <view
            react-ref-2-0="1"
          />
        </view>
      </page>
    `);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          RefProxy {
            "refAttr": [
              2,
              0,
            ],
            "task": undefined,
          },
        ],
      ]
    `);
    expect(cleanup.mock.calls).toMatchInlineSnapshot(`[]`);
    expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);
    act(() => {
      _setShow(false);
    });
    expect(elementTree).toMatchInlineSnapshot(`<page />`);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          RefProxy {
            "refAttr": [
              2,
              0,
            ],
            "task": undefined,
          },
        ],
      ]
    `);
    expect(cleanup.mock.calls).toMatchInlineSnapshot(`
      [
        [],
      ]
    `);
    expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(2);
    vi.resetAllMocks();
  });

  it('unmount', async () => {
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(0);

    const cleanup = vi.fn();
    const ref1 = vi.fn(() => {
      return cleanup;
    });
    const ref2 = createRef();

    function App() {
      return <Comp show={true} />;
    }

    class Comp extends Component {
      name = 'comp';
      render() {
        return (
          this.props.show && (
            <view>
              <view ref={ref1} />
              <view ref={ref2} />
            </view>
          )
        );
      }
    }
    const { unmount } = render(<App />);
    expect(elementTree).toMatchInlineSnapshot(`
      <page>
        <view>
          <view
            react-ref-2-0="1"
          />
          <view
            react-ref-2-1="1"
          />
        </view>
      </page>
    `);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          RefProxy {
            "refAttr": [
              2,
              0,
            ],
            "task": undefined,
          },
        ],
      ]
    `);
    expect(ref2.current).toMatchInlineSnapshot(`
      RefProxy {
        "refAttr": [
          2,
          1,
        ],
        "task": undefined,
      }
    `);
    expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);
    unmount();
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          RefProxy {
            "refAttr": [
              2,
              0,
            ],
            "task": undefined,
          },
        ],
      ]
    `);
    expect(ref2.current).toBeNull();
    expect(cleanup.mock.calls).toMatchInlineSnapshot(`
      [
        [],
      ]
    `);
    expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(2);
    vi.resetAllMocks();
  });

  it('spread undefined ref should work', () => {
    let setProps, setShowChild;
    const Child = () => {
      const [props, _setProps] = useState({ ref: undefined });
      setProps = _setProps;

      return <view {...props} />;
    };
    const App = () => {
      let [showChild, _setShowChild] = useState(true);
      setShowChild = _setShowChild;

      return showChild && <Child />;
    };

    render(<App />);

    act(() => {
      setShowChild(false);
    });
  });
});

describe('applyRef before hydration', () => {
  it('rerender with same ref callback should not invoke ref callback', () => {
    const refCallback = vi.fn();
    let bump;

    function App() {
      const [, setTick] = useState(0);
      bump = () => setTick(t => t + 1);

      useEffect(() => {
        // This will trigger a rerender before hydration
        bump();
      }, []);

      return <view ref={refCallback} />;
    }

    render(<App />);
    expect(refCallback).toHaveBeenCalledTimes(1);
    expect(refCallback.mock.calls[0][0]).toMatchObject({
      refAttr: expect.any(Array),
    });
  });

  const forms = [
    'normal',
    'spread',
  ];
  forms.forEach((key) => {
    forms.forEach((key2) => {
      it(`rerender when ref is changed from ${key} to ${key2}`, () => {
        const oldCb = vi.fn();
        const newCb = vi.fn();
        let bump;

        function App() {
          const [tick, setTick] = useState(0);
          bump = () => setTick(t => t + 1);

          useEffect(() => {
            // This will trigger a rerender before hydration
            bump();
          }, []);

          const isFirst = tick === 0;
          const ref = isFirst ? oldCb : newCb;
          const form = isFirst ? key : key2;

          if (form === 'spread') {
            return <view {...{ ref }} />;
          }
          return <view ref={ref} />;
        }

        render(<App />);

        expect(oldCb).toHaveBeenCalledTimes(2);
        expect(oldCb.mock.calls[0][0]).toMatchObject({
          refAttr: expect.any(Array),
        });
        expect(oldCb.mock.calls[1][0]).toBeNull();

        expect(newCb).toHaveBeenCalledTimes(1);
        expect(newCb.mock.calls[0][0]).toMatchObject({
          refAttr: expect.any(Array),
        });
      });
    });
  });

  it('useRef + useEffect + setState host capture is stable (portal-host pattern)', () => {
    const seenHosts = vi.fn();

    function App() {
      const hostRef = useRef(null);
      const [host, setHost] = useState(null);
      useEffect(() => {
        setHost(hostRef.current);
      }, []);
      if (host) seenHosts(host);
      return <view ref={hostRef} />;
    }

    render(<App />);
    expect(seenHosts).toHaveBeenCalledTimes(1);
  });
});
