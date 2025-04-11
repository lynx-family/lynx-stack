import { Component } from '@lynx-js/react';
import { fireEvent, render } from '..';
import { expect, vi } from 'vitest';

class StopWatch extends Component {
  state = { lapse: 0, running: false };

  handleRunClick = () => {
    this.setState((state) => {
      if (state.running) {
        clearInterval(this.timer);
      } else {
        const startTime = Date.now() - this.state.lapse;
        this.timer = setInterval(() => {
          this.setState({ lapse: Date.now() - startTime });
        });
      }
      return { running: !state.running };
    });
  };

  handleClearClick = () => {
    clearInterval(this.timer);
    this.setState({ lapse: 0, running: false });
  };

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  render({ lapse, running }) {
    return (
      <view>
        <text>{lapse}ms</text>
        <text bindtap={this.handleRunClick}>
          {running ? 'Stop' : 'Start'}
        </text>
        <text bindtap={this.handleClearClick}>Clear</text>
      </view>
    );
  }
}

const wait = (time) => new Promise((resolve) => setTimeout(resolve, time));

test('unmounts a component', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});

  const { unmount, container, getByText } = render(<StopWatch />);

  expect(container).toMatchInlineSnapshot(`
    <page>
      <view>
        <text>
          <wrapper />
          ms
        </text>
        <text>
          Start
        </text>
        <text>
          Clear
        </text>
      </view>
    </page>
  `);

  fireEvent.tap(getByText('Start'));

  unmount();

  // Hey there reader! You don't need to have an assertion like this one
  // this is just me making sure that the unmount function works.
  // You don't need to do this in your apps. Just rely on the fact that this works.
  expect(elementTree.root).toMatchInlineSnapshot(`undefined`);

  // Just wait to see if the interval is cleared or not.
  // If it's not, then we'll call setState on an unmounted component and get an error.
  await wait(() => expect(console.error).not.toHaveBeenCalled());
});
