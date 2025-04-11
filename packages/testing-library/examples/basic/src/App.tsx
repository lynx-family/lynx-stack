import { Component } from '@lynx-js/react';

export interface IProps {
  onMounted?: () => void;
}

export class App extends Component<IProps> {
  override componentDidMount() {
    this.props?.onMounted?.();
  }

  override render() {
    return (
      <view>
        <text id='app-text'>Hello World!</text>
      </view>
    );
  }
}
