interface AppProps {
  label?: string;
}

export function App({ label = 'first' }: AppProps) {
  const handleTap = () => {
    'main thread';
    console.log(label);
  };
  return <view main-thread:bindtap={handleTap} />;
}
