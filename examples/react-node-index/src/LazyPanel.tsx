export default function LazyPanel() {
  return (
    <view className='Card'>
      <text className='CardTitle'>Lazy node index mapping</text>
      <text className='CardBody'>
        This panel is loaded from a lazy chunk, so it gets its own
        node-index-map asset and uploaded URL.
      </text>
    </view>
  );
}
