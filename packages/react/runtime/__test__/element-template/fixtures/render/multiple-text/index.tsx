import { Component } from '@lynx-js/react';
export class App extends Component {
  render() {
    const items = ['A', 'B', 'C'];
    return (
      <view>
        <view id='1'>
          {items}
        </view>
        <view id='2'>
          {items.map((item) => <text>{item}</text>)}
        </view>
        <view id='3'>
          <text>{items}</text>
        </view>
        <view id='4'>
          <text>{items.map((item) => <text>{item}</text>)}</text>
        </view>
      </view>
    );
  }
}
