import { useMainThreadRef, root } from '@lynx-js/react';

export const ScrollItem = (props) => {
  // Calculate gradient angle based on index to create wave effect
  const angle = 90 + 6 * props.index;

  return (
    <view
      style={{
        width: props.width,
        height: props.height,
        background:
          `linear-gradient(${angle}deg, rgb(255,53,26), rgb(0,235,235))`,
        margin: '3px',
        borderRadius: '10px',
      }}
    >
    </view>
  );
};

export const App = () => {
  const scrollRef = useMainThreadRef(null);

  const handleTap = () => {
    'main thread';
    scrollRef.current?.invoke('autoScroll', {
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
      <view main-thread:bindtap={handleTap} id='target'>
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
        main-thread:ref={scrollRef}
        scroll-orientation='vertical'
        style={{ width: '100%', height: '300px', paddingLeft: '5px' }}
      >
        {Array.from({ length: 5 }).map((item, index) => (
          <ScrollItem width='calc(100% - 10px)' height='100px' index={index} />
        ))}
      </scroll-view>
    </view>
  );
};
root.render(<App />);
