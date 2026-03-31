export default function LazyPanel() {
  return (
    <view className='Card'>
      <text className='CardTitle'>Lazy UI source map</text>
      <text className='CardBody'>
        This panel is loaded from a lazy chunk, so it gets its own ui-source-map
        asset and uploaded URL.
      </text>
    </view>
  );
}
