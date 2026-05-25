import { useInitData } from '@lynx-js/react/element-template';

export function App(): JSX.Element {
  const data = useInitData() as { msg?: string };

  return (
    <view>
      <text>{data.msg}</text>
    </view>
  );
}
