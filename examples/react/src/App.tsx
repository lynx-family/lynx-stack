import { useEffect, useState } from '@lynx-js/react';

import { MTComponent } from './MTC.js';

function BTC(props: { text: string }) {
  return <text>{props.text}</text>;
}

function ba(e) {
  'background';
  console.log('ba', e);
}

export function App() {
  const [text1, setText1] = useState(123);
  const [text2, setText2] = useState(456);
  const [showMTC1, setShowMTC1] = useState(true);

  const btc1 = <BTC text={String(text1)} />;
  const btc2 = (
    <view
      bindtap={() => {
        setText2((v) => v + 1);
      }}
    >
      <BTC text={String(text2)} />
    </view>
  );

  // useEffect(() => {
  //   setTimeout(() => {
  //     setText1('Hello ');
  //     setText2('World!');
  //   }, 2000);
  // }, []);

  return (
    <view>
      <text
        style={{ 'fontSize': '30px' }}
        bindtap={() => {
          setShowMTC1(!showMTC1);
        }}
      >
        Show={showMTC1.toString()}
      </text>
      {showMTC1 && <MTComponent btc1={btc1} btc2={btc2} ba={ba} />}
    </view>
  );
}
