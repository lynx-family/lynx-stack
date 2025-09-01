import { useEffect, useState } from '@lynx-js/react';

import { MTC } from './MTC.js';

function BTC(props: { text: string }) {
  return <text>{props.text}</text>;
}

function ba(e) {
  'background';
  console.log('ba', e);
}

export function App() {
  const [text1, setText1] = useState('123');
  const [text2, setText2] = useState('456');
  const [showMTC1, setShowMTC1] = useState(true);

  const btc1 = <BTC text={text1} />;
  const btc2 = <BTC text={text2} />;

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
        MTC show={showMTC1.toString()}
      </text>
      {showMTC1 && <MTC btc1={btc1} btc2={btc2} ba={ba} />}
    </view>
  );
}
