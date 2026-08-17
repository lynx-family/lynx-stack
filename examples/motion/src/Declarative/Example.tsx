import { motion, useMotionValue } from '@lynx-js/motion';
import { useState } from '@lynx-js/react';

import './styles.css';

export default function DeclarativeExample() {
  const [active, setActive] = useState(false);
  const scale = useMotionValue(1);

  function pulse() {
    'main thread';
    scale.set(scale.get() === 1 ? 1.2 : 1);
  }

  return (
    <view className='declarative-container'>
      <motion.view
        className='declarative-box'
        initial={{ opacity: 0, x: -80 }}
        animate={{
          opacity: 1,
          x: active ? 160 : 0,
          rotate: active ? 12 : 0,
        }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        style={{ scale }}
        main-thread:bindtap={pulse}
      >
        <text>Tap me</text>
      </motion.view>
      <view
        className='declarative-button'
        bindtap={() => setActive(value => !value)}
      >
        <text>{active ? 'Move back' : 'Move with declarative props'}</text>
      </view>
    </view>
  );
}
