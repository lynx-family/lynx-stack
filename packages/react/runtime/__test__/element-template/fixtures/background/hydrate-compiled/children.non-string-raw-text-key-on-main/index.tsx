interface AppProps {
  value: number;
}

export function App({ value }: AppProps) {
  return (
    <view>
      <text>{value}</text>
    </view>
  );
}

export const mainProps = { value: 1 };
export const backgroundProps = { value: 2 };
