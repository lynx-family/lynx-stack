import { useState, root } from '@lynx-js/react';

function App() {
  const [btsClicked, setBtsClicked] = useState(false);

  const handleBtsTap = () => {
    setBtsClicked(true);
    console.log('BTS Clicked');
  };

  const handleMtsTap = (event) => {
    'main thread';
    event.currentTarget.setAttribute('data-mts-clicked', 'true');
    console.log('MTS Clicked');
  };

  return (
    <view>
      <view
        id='target'
        bindtap={handleBtsTap}
        main-thread:bindtap={handleMtsTap}
        style={{
          height: '100px',
          width: '100px',
          background: btsClicked ? 'green' : 'red',
        }}
        data-mts-clicked='false'
      />
      <text id='bts-status'>
        {btsClicked ? 'BTS Clicked' : 'BTS Not Clicked'}
      </text>
    </view>
  );
}

root.render(<App />);
