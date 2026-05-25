interface AppProps {
  showNew?: boolean;
}

export function App({ showNew = false }: AppProps) {
  return (
    <view>
      {showNew ? <view key='new' /> : null}
    </view>
  );
}

export const mainProps = { showNew: false };
export const backgroundProps = { showNew: true };
