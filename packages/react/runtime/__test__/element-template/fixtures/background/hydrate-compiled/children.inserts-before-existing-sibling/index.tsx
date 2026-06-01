interface AppProps {
  withInserted?: boolean;
}

function FirstItem() {
  return <view id='first' />;
}

function InsertedItem() {
  return <text>inserted</text>;
}

function ThirdItem() {
  return <view class='third' />;
}

export function App({ withInserted = false }: AppProps) {
  return (
    <view>
      {withInserted
        ? (
          <>
            <InsertedItem />
            <FirstItem />
            <ThirdItem />
          </>
        )
        : (
          <>
            <FirstItem />
            <ThirdItem />
          </>
        )}
    </view>
  );
}

export const mainProps = { withInserted: false };
export const backgroundProps = { withInserted: true };
