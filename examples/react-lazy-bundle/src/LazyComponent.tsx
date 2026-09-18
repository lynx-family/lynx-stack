import './LazyComponent.css';
import { BackgroundOnlyCard } from './BackgroundOnlyCard.jsx';

export default function LazyComponent() {
  return (
    <view className='LazyCard'>
      <view className='LazyCard__badgeRow'>
        <view className='LazyCard__badge'>
          <text className='LazyCard__badgeText'>lazy bundle</text>
        </view>
      </view>
      <text className='LazyComponent'>LazyComponent</text>
      {__MAIN_THREAD__
        ? <view className='LazyCard__skeleton' />
        : <BackgroundOnlyCard />}
    </view>
  );
}
