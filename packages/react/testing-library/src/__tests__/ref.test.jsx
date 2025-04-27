import { createRef, Component, useState } from '@lynx-js/react';
import { render } from '..';
import { expect, vi } from 'vitest';
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
            has-react-ref="true"
          />
          <view
            has-react-ref="true"
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
          NodesRef {
            "_nodeSelectToken": {
              "identifier": "3",
              "type": 2,
            },
            "_selectorQuery": {},
          },
        ],
      ]
    `);
    expect(ref4.current).toMatchInlineSnapshot(`
      NodesRef {
        "_nodeSelectToken": {
          "identifier": "4",
          "type": 2,
        },
        "_selectorQuery": {},
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
            has-react-ref="true"
          />
          <view
            has-react-ref="true"
          />
        </view>
      </page>
    `);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          NodesRef {
            "_nodeSelectToken": {
              "identifier": "2",
              "type": 2,
            },
            "_selectorQuery": {},
          },
        ],
      ]
    `);
    expect(ref2.current).toMatchInlineSnapshot(`
      NodesRef {
        "_nodeSelectToken": {
          "identifier": "3",
          "type": 2,
        },
        "_selectorQuery": {},
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
            has-react-ref="true"
          />
          <view
            has-react-ref="true"
          />
        </view>
      </page>
    `);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          NodesRef {
            "_nodeSelectToken": {
              "identifier": "2",
              "type": 2,
            },
            "_selectorQuery": {},
          },
        ],
      ]
    `);
    expect(ref2.current).toMatchInlineSnapshot(`
      NodesRef {
        "_nodeSelectToken": {
          "identifier": "3",
          "type": 2,
        },
        "_selectorQuery": {},
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
            has-react-ref="true"
          />
          <view
            has-react-ref="true"
          />
        </view>
      </page>
    `);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          NodesRef {
            "_nodeSelectToken": {
              "identifier": "2",
              "type": 2,
            },
            "_selectorQuery": {},
          },
        ],
      ]
    `);
    expect(ref2.current).toMatchInlineSnapshot(`
      NodesRef {
        "_nodeSelectToken": {
          "identifier": "3",
          "type": 2,
        },
        "_selectorQuery": {},
      }
    `);
    act(() => {
      _setShow(false);
    });
    expect(elementTree).toMatchInlineSnapshot(`<page />`);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          NodesRef {
            "_nodeSelectToken": {
              "identifier": "2",
              "type": 2,
            },
            "_selectorQuery": {},
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
            has-react-ref="true"
          />
        </view>
      </page>
    `);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          NodesRef {
            "_nodeSelectToken": {
              "identifier": "2",
              "type": 2,
            },
            "_selectorQuery": {},
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
          NodesRef {
            "_nodeSelectToken": {
              "identifier": "2",
              "type": 2,
            },
            "_selectorQuery": {},
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
            has-react-ref="true"
          />
          <view
            has-react-ref="true"
          />
        </view>
      </page>
    `);
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          NodesRef {
            "_nodeSelectToken": {
              "identifier": "2",
              "type": 2,
            },
            "_selectorQuery": {},
          },
        ],
      ]
    `);
    expect(ref2.current).toMatchInlineSnapshot(`
      NodesRef {
        "_nodeSelectToken": {
          "identifier": "3",
          "type": 2,
        },
        "_selectorQuery": {},
      }
    `);
    expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);
    unmount();
    expect(ref1.mock.calls).toMatchInlineSnapshot(`
      [
        [
          NodesRef {
            "_nodeSelectToken": {
              "identifier": "2",
              "type": 2,
            },
            "_selectorQuery": {},
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
});
