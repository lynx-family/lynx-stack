import { root, useEffect, useState } from '@lynx-js/react';

function App() {
  const [info, setInfo] = useState({});
  useEffect(() => {
    setInfo({
      pixelWidth: SystemInfo.pixelWidth,
      pixelHeight: SystemInfo.pixelHeight,
    });
  }, []);
  return (
    <view>
      <text id='width'>{info.pixelWidth}</text>
      <text id='height'>{info.pixelHeight}</text>
    </view>
  );
}

root.render(<App></App>);
