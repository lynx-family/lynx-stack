interface AppProps {
  variant?: 'main' | 'background';
}

function FirstItem() {
  return <view id='a' />;
}

function SecondItem() {
  return <view id='b' />;
}

function Label({ text }: { text: string }) {
  return <text>{text}</text>;
}

function ExtraImage() {
  return <image />;
}

export function App({ variant = 'main' }: AppProps) {
  const isBackground = variant === 'background';

  return (
    <view id={isBackground ? 'bg' : 'main'}>
      {isBackground
        ? (
          <>
            <SecondItem />
            <Label text='BG' />
            <FirstItem />
            <ExtraImage />
          </>
        )
        : (
          <>
            <FirstItem />
            <Label text='Main' />
            <SecondItem />
          </>
        )}
    </view>
  );
}

export const mainProps = { variant: 'main' as const };
export const backgroundProps = { variant: 'background' as const };
