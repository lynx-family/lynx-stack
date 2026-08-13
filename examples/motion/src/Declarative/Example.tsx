import { motion, useMotionValue } from '@lynx-js/motion';
import { useState } from '@lynx-js/react';

import './styles.css';

export default function DeclarativeExample() {
  const [active, setActive] = useState(false);
  const scale = useMotionValue(1);
  const [interaction, setInteraction] = useState('idle');
  const [tapCount, setTapCount] = useState(0);
  const [hoverCount, setHoverCount] = useState(0);
  const [animationStarts, setAnimationStarts] = useState(0);
  const [animationCompletes, setAnimationCompletes] = useState(0);

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
        <text className='declarative-button-label'>
          {active ? 'Move back' : 'Move with declarative props'}
        </text>
      </view>
      <view className='gesture-probe'>
        <motion.view
          id='gesture-lifecycle-card'
          className='gesture-card'
          animate={{ scale: 1, backgroundColor: '#20242c' }}
          whileHover={{ scale: 1.06, backgroundColor: '#334155' }}
          whileTap={{ scale: 0.94, backgroundColor: '#0f766e' }}
          transition={{ duration: 0.12 }}
          onHoverStart={() => {
            setInteraction('hover');
            setHoverCount(value => value + 1);
          }}
          onHoverEnd={() => setInteraction('idle')}
          onTapStart={() => setInteraction('press')}
          onTap={() => {
            setInteraction('hover');
            setTapCount(value => value + 1);
          }}
          onTapCancel={() => setInteraction('idle')}
          onAnimationStart={() => setAnimationStarts(value => value + 1)}
          onAnimationComplete={() => setAnimationCompletes(value => value + 1)}
        >
          <text className='gesture-card-title'>Interaction lifecycle</text>
          <text id='gesture-state' className='gesture-card-state'>
            {interaction}
          </text>
        </motion.view>
        <view className='gesture-metrics'>
          <text id='gesture-tap-count'>tap {tapCount}</text>
          <text id='gesture-hover-count'>hover {hoverCount}</text>
          <text id='gesture-animation-counts'>
            animation {animationStarts}/{animationCompletes}
          </text>
        </view>
      </view>
    </view>
  );
}
