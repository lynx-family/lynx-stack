import { root } from '@lynx-js/react';

import './detail.css';

export function Detail() {
  return (
    <view className='detail'>
      <text id='title'>Detail card</text>
    </view>
  );
}

root.render(<Detail />);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
