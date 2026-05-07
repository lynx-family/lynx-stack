interface AppProps {
  reversed?: boolean;
}

function FirstItem() {
  return <view id='first' />;
}

function SecondItem() {
  return <text>second</text>;
}

export function App({ reversed = false }: AppProps) {
  return (
    <view>
      {reversed
        ? (
          <>
            <SecondItem />
            <FirstItem />
          </>
        )
        : (
          <>
            <FirstItem />
            <SecondItem />
          </>
        )}
    </view>
  );
}

export const mainProps = { reversed: false };
export const backgroundProps = { reversed: true };
