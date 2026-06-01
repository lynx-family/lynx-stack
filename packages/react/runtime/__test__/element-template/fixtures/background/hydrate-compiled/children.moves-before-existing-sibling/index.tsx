interface AppProps {
  reversed?: boolean;
}

function FirstItem() {
  return <view id='first' />;
}

function SecondItem() {
  return <text>second</text>;
}

function ThirdItem() {
  return <view class='third' />;
}

export function App({ reversed = false }: AppProps) {
  return (
    <view>
      {reversed
        ? (
          <>
            <SecondItem />
            <FirstItem />
            <ThirdItem />
          </>
        )
        : (
          <>
            <FirstItem />
            <SecondItem />
            <ThirdItem />
          </>
        )}
    </view>
  );
}

export const mainProps = { reversed: false };
export const backgroundProps = { reversed: true };
