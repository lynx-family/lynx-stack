import { Deferred } from './deferred.jsx';

export function App() {
  return (
    <view>
      <background-only fallback={<text text='fallback-content' />}>
        <Deferred />
      </background-only>
    </view>
  );
}
