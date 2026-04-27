import { Component } from '@lynx-js/react';
class Inner extends Component<{ message: string }> {
  render() {
    return (
      <view>
        {this.props.message}
      </view>
    );
  }
}
export class App extends Component {
  render() {
    return (
      <view>
        <Inner message='X' />
      </view>
    );
  }
}
