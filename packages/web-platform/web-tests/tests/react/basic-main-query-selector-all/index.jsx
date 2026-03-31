import { root } from '@lynx-js/react';

export const App = () => {
  const handleTap = () => {
    'main thread';
    const items = lynx.querySelectorAll('.item');
    if (items && items.length > 0) {
      items[2]?.invoke('autoScroll', {
        rate: 120,
        start: true,
      });
    }
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
          Tap me to scroll the 3rd item
        </text>
      </view>
      {Array.from({ length: 4 }).map((_, index) => (
        <scroll-view
          key={index}
          class='item'
          scroll-orientation='vertical'
          style={{
            width: '100%',
            height: '100px',
            paddingLeft: '5px',
            marginTop: '10px',
            backgroundColor: 'pink',
          }}
        >
          {Array.from({ length: 10 }).map((item, i) => (
            <view
              key={i}
              style={{
                width: 'calc(100% - 10px)',
                height: '50px',
                backgroundColor: i % 2 === 0 ? 'red' : 'blue',
                margin: '5px',
              }}
            >
              <text>Inner Item {i}</text>
            </view>
          ))}
        </scroll-view>
      ))}
    </view>
  );
};

root.render(<App />);
