import { Component } from '@lynx-js/react';

function PrimaryRow({ label }: { label: string }) {
  return (
    <view>
      <text>{label}</text>
    </view>
  );
}

function SecondaryRow({ label }: { label: string }) {
  return (
    <view>
      <text>{label}</text>
    </view>
  );
}

export class App extends Component {
  render() {
    return (
      <view>
        <PrimaryRow label='Alpha' />
        <SecondaryRow label='Beta' />
      </view>
    );
  }
}
