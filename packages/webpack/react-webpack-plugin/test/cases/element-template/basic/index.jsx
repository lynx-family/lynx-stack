import { Component } from '@lynx-js/react';

const name = 'world';
const fn = vi.fn();

class App extends Component {
  render() {
    fn();
    return <view>Hello, {name}</view>;
  }
}

it('should render', () => {
  expect(fn).not.toBeCalled();
  expect(App).toBeDefined();
});
