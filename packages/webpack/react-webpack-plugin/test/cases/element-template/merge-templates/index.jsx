import { Deferred } from './deferred.jsx';

export function App() {
  return (
    <view>
      {__MAIN_THREAD__ ? <text text='main-thread-shell' /> : <Deferred />}
    </view>
  );
}
