interface AppProps {
  variant?: 'main' | 'background';
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

export function App({ variant = 'main' }: AppProps) {
  return (
    <view>
      {variant === 'background'
        ? (
          <>
            <SecondItem />
            <ThirdItem />
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

export const mainProps = { variant: 'main' as const };
export const backgroundProps = { variant: 'background' as const };
