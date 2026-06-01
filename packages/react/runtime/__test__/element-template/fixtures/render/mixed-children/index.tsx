import { Component } from '@lynx-js/react';
export class App extends Component {
  render() {
    const leading = 'A';
    const innerText = 'B';
    const trailing = 'C';
    return (
      <view>
        {leading}
        <view>{innerText}</view>
        {trailing}
      </view>
    );
  }
}
