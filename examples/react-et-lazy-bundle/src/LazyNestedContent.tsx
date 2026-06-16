import './LazyComponent.css';

export default function LazyNestedContent() {
  return (
    <view className='LazyPanel'>
      <text className='LazyComponent'>nested-ready</text>
    </view>
  );
}
