import { root } from '@lynx-js/react';

export const App = () => {
  const handleTap = () => {
    'main thread';
    const scrollView = lynx.querySelector('#scroll-view');
    scrollView?.invoke('autoScroll', {
      rate: 120,
      start: true,
    });
  };

  return (
    <view
      style={{
        width: '100%',
        height: '100%',
        padding: '10px',
        display: 'linear',
        marginTop: '20px',
      }}
    >
      <view main-thread:bindtap={handleTap} id='tap-me'>
        <text
          style={{
            fontSize: '20px',
            height: '40px',
            paddingLeft: '10px',
            marginTop: '10px',
          }}
        >
          Tap me to enable auto-scroll
        </text>
      </view>
      <scroll-view
        id='scroll-view'
        scroll-orientation='vertical'
        style={{ width: '100%', height: '300px', paddingLeft: '5px' }}
      >
        {Array.from({ length: 20 }).map((item, index) => (
          <view
            style={{
              width: 'calc(100% - 10px)',
              height: '100px',
              backgroundColor: index % 2 === 0 ? 'red' : 'blue',
              margin: '5px',
            }}
          >
            <text>Item {index}</text>
          </view>
        ))}
      </scroll-view>
    </view>
  );
};

root.render(<App />);
