import { B } from './b.jsx';
import { M } from './m.jsx';

export function App() {
  return (
    <view style={{ paddingTop: '100px' }}>
      {__MAIN_THREAD__
        ? (
          <>
            <text>text-1-main-only</text>
            <M />
          </>
        )
        : (
          <>
            <text>text-2-background-only</text>
            <B />
          </>
        )}
    </view>
  );
}
