export function Feed() {
  const onTap = () => {
    'main thread';
    console.info('marker-feed-worklet');
  };
  console.info('marker-feed-logic');
  return <text attr-feed='marker-feed-content' main-thread:bindtap={onTap} />;
}
