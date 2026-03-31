import { root } from '@lynx-js/react';
export default function App() {
  return (
    <view
      style={{
        flexDirection: 'column',
        background: 'skyblue',
        height: '100vh',
      }}
    >
      <scroll-view
        scroll-y
        className='w-screen bg-gray-100'
        style={{ height: '600px' }}
      >
        <view
          style={{
            backgroundColor: 'skyblue',
            width: '100%',
            height: '1600px',
          }}
        >
          <view
            style={{ backgroundColor: 'red', width: '100%', height: '100px' }}
          >
          </view>
          <view
            style={{
              backgroundColor: 'purple',
              width: '100%',
              height: '100px',
            }}
          >
          </view>
          <view
            style={{
              backgroundColor: 'orange',
              width: '100%',
              height: '100px',
            }}
          >
          </view>
          <view
            style={{ backgroundColor: 'green', width: '100%', height: '100px' }}
          >
          </view>
          <view
            style={{ backgroundColor: 'blue', width: '100%', height: '100px' }}
          >
          </view>
          <view
            style={{
              backgroundColor: 'yellow',
              width: '100%',
              height: '100px',
              position: 'fixed',
              bottom: '32px',
            }}
          >
          </view>
        </view>
      </scroll-view>
    </view>
  );
}
root.render(
  <page style={{ width: '100%' }}>
    <App />
  </page>,
);
