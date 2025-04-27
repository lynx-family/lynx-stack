import { Component } from '@lynx-js/react';

export interface IProps {
  onMounted?: () => void;
}

export class App extends Component<IProps> {
  override componentDidMount(): void {
    this.props?.onMounted?.();
  }

  override render(): JSX.Element {
    return (
      <view>
        <text id='app-text'>Hello World!</text>
      </view>
    );
  }
}
