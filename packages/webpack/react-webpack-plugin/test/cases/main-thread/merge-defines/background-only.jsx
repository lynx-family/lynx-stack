export function BackgroundOnly() {
  const onTap = () => {
    'main thread';
    console.info('marker-worklet-background');
  };
  return <text attr-bg='marker-background-only' main-thread:bindtap={onTap} />;
}
