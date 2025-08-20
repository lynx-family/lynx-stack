import { useEffect, useState } from '@lynx-js/react';

import { MTC } from './MTC.js';

function BTC(props: { text: string }) {
  return <text>{props.text}</text>;
}

export function App() {
  const [text1, setText1] = useState('123');
  const [text2, setText2] = useState('456');

  const btc1 = <BTC text={text1} />;
  const btc2 = <BTC text={text2} />;

  useEffect(() => {
    setTimeout(() => {
      setText1('Hello ');
      setText2('World!');
    }, 2000);
  }, []);

  return (
    <view>
      <MTC btc1={btc1} btc2={btc2} />
    </view>
  );
}
