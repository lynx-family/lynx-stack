import '@testing-library/jest-dom';
import { test, expect } from 'vitest';
import { render } from '..';
import { createRef } from '@lynx-js/react';
import { Component } from 'preact';

test('renders view into page', async () => {
  const ref = createRef();
  const Comp = () => {
    return (
      <view ref={ref}>
        <image />
        <text />
        <view />
        <scroll-view />
      </view>
    );
  };
  render(<Comp />);
  expect(ref.current).toMatchInlineSnapshot(`
    RefProxy {
      "refAttr": [
        2,
        0,
      ],
      "task": undefined,
    }
  `);
});

test('renders options.wrapper around node', async () => {
  const WrapperComponent = ({ children }) => <view data-testid='wrapper'>{children}</view>;
  const Comp = () => {
    return <view data-testid='inner' style='background-color: yellow;' />;
  };
  const { container, getByTestId } = render(<Comp />, {
    wrapper: WrapperComponent,
  });
  expect(getByTestId('wrapper')).toBeInTheDocument();
  expect(container.firstChild).toMatchInlineSnapshot(`
    <view
      data-testid="wrapper"
    >
      <view
        data-testid="inner"
        style="background-color: yellow;"
      />
    </view>
  `);
});

describe('dynamic key in snapshot', () => {
  test('multiple slots 0', () => {
    const Comp = () => (
      <view>
        <view className='foo' key={`foo`}>
          <view>
            {<text>foo</text>}
          </view>
          <view>
            {<text>bar</text>}
          </view>
        </view>
      </view>
    );

    const { container } = render(<Comp />);

    expect(container).toMatchInlineSnapshot(`
      <page>
        <view>
          <view
            class="foo"
          >
            <wrapper>
              <view>
                <text>
                  foo
                </text>
              </view>
              <view>
                <text>
                  bar
                </text>
              </view>
            </wrapper>
          </view>
        </view>
      </page>
    `);
  });

  test('multiple slots 1', () => {
    const Comp = () => (
      <view>
        <text>Hello {null}</text>
        <view className='foo' key={`foo`}>
          <view>
            {<text>foo</text>}
          </view>
          <view>
            {<text>bar</text>}
          </view>
        </view>
      </view>
    );

    const { container } = render(<Comp />);

    expect(container).toMatchInlineSnapshot(`
      <page>
        <view>
          <text>
            Hello 
            <wrapper />
          </text>
          <view
            class="foo"
          >
            <wrapper>
              <view>
                <text>
                  foo
                </text>
              </view>
              <view>
                <text>
                  bar
                </text>
              </view>
            </wrapper>
          </view>
        </view>
      </page>
    `);
  });

  test('multiple slots 2', () => {
    const Comp = () => (
      <view>
        <view className='foo' key={`foo`}>
          <view>
            {<text>foo</text>}
          </view>
          <view>
            {<text>bar</text>}
          </view>
        </view>
        <text>Hello {null}</text>
      </view>
    );

    const { container } = render(<Comp />);

    expect(container).toMatchInlineSnapshot(`
      <page>
        <view>
          <view
            class="foo"
          >
            <wrapper>
              <view>
                <text>
                  foo
                </text>
              </view>
              <view>
                <text>
                  bar
                </text>
              </view>
            </wrapper>
          </view>
          <text>
            Hello 
            <wrapper />
          </text>
        </view>
      </page>
    `);
  });

  test('multiple slots 3', () => {
    const Comp = () => (
      <view className='foo' key={`foo`}>
        <view>
          <view>
            {<text>foo</text>}
          </view>
          <view>
            {<text>bar</text>}
          </view>
        </view>
      </view>
    );

    const { container } = render(<Comp />);

    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          class="foo"
        >
          <wrapper>
            <view>
              <view>
                <text>
                  foo
                </text>
              </view>
              <view>
                <text>
                  bar
                </text>
              </view>
            </view>
          </wrapper>
        </view>
      </page>
    `);
  });

  test('multiple keys', () => {
    const Comp = () => (
      <view>
        <view className='foo' key={`foo`}>
          <view>
            {<text>foo</text>}
          </view>
          <view key={`bar`}>
            {<text>bar</text>}
          </view>
        </view>
      </view>
    );

    const { container } = render(<Comp />);

    expect(container).toMatchInlineSnapshot(`
      <page>
        <view>
          <view
            class="foo"
          >
            <wrapper>
              <view>
                <text>
                  foo
                </text>
              </view>
              <view>
                <text>
                  bar
                </text>
              </view>
            </wrapper>
          </view>
        </view>
      </page>
    `);
  });
});

it('should handle keyed replacements', () => {
  const actions = [];
  class Comp extends Component {
    componentDidMount() {
      actions.push('mounted ' + this.props.i);
    }
    render() {
      return <text>Hello</text>;
    }
  }

  const App = props => {
    return (
      <view>
        <Comp key={props.y} i={1} />
        {false}
        <Comp i={2} />
        <Comp i={3} />
      </view>
    );
  };

  render(<App y='1' />);
  expect(actions).to.deep.equal(['mounted 1', 'mounted 2', 'mounted 3']);

  render(<App y='2' />);
  expect(actions).to.deep.equal([
    'mounted 1',
    'mounted 2',
    'mounted 3',
    'mounted 1',
  ]);
});
