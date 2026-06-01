interface AppProps {
  withLeadingItem?: boolean;
}

function LeadingItem() {
  return <view id='x' />;
}

function FirstItem() {
  return <view id='a' />;
}

function SecondItem() {
  return <view id='b' />;
}

export function App({ withLeadingItem = false }: AppProps) {
  return (
    <view>
      {withLeadingItem
        ? (
          <>
            <LeadingItem />
            <FirstItem />
            <SecondItem />
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

export const mainProps = { withLeadingItem: false };
export const backgroundProps = { withLeadingItem: true };
