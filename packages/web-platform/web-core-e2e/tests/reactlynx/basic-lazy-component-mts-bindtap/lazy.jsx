import { useMainThreadRef } from '@lynx-js/react';

export default function Lazy() {
  const ref = useMainThreadRef(null);

  const handleTap = () => {
    'main thread';
    if (ref.current) {
      ref.current.setStyleProperty('background-color', 'green');
    }
  };

  return (
    <view
      id='target'
      main-thread:ref={ref}
      main-thread:bindtap={handleTap}
      style={{
        height: '100px',
        width: '100px',
        background: 'pink',
      }}
    />
  );
}
