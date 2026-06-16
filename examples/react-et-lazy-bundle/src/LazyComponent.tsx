import './LazyComponent.css';

export default function LazyComponent(
  { marker = 'basic-ready' }: { marker?: string },
) {
  return (
    <view className='LazyPanel'>
      <text className='LazyComponent'>{marker}</text>
    </view>
  );
}
