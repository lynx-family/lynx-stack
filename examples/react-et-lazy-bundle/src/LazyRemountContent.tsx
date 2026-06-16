import './LazyComponent.css';

export default function LazyRemountContent({ cycle }: { cycle: number }) {
  return (
    <view className='LazyPanel'>
      <text className='LazyComponent'>remount-ready-{cycle}</text>
    </view>
  );
}
