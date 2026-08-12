import './LazyComponent.css';
import { BackgroundOnlyCard } from './BackgroundOnlyCard.jsx';

export default function LazyComponent() {
  return (
    <view>
      <text className='LazyComponent'>LazyComponent</text>
      {__MAIN_THREAD__ ? <text>skeleton</text> : <BackgroundOnlyCard />}
    </view>
  );
}
