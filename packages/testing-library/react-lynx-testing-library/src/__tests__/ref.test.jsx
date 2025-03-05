import { createRef, Component } from '@lynx-js/react';
import { render } from '..';
import { expect } from 'vitest';

describe('component ref', () => {
  it('basic', async () => {
    const ref1 = vi.fn();
    const ref2 = createRef();

    class Child extends Component {
      x = 'x';
      render() {
        return <view />;
      }
    }

    class Comp extends Component {
      x = 'x';
      render() {
        return this.props.show && (
          <view>
            <Child ref={ref1} />
            <Child ref={ref2} />
          </view>
        );
      }
    }

    render(<Comp show />);
    expect(ref1).toBeCalledWith(expect.objectContaining({
      x: 'x',
    }));
    expect(ref2.current).toHaveProperty('x', 'x');
  });
});
