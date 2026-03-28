import { root } from '@lynx-js/react';

function App() {
  return (
    <view
      id='target'
      style={{
        height: '20ppx',
        width: '20ppx',
        background: 'pink',
      }}
    />
  );
}

root.render(<App></App>);
