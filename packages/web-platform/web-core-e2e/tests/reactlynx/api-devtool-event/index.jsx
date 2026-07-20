// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useEffect, useState } from '@lynx-js/react';

function App() {
  const [message, setMessage] = useState('waiting');

  useEffect(() => {
    const devtool = lynx.getDevtool();
    const handleMessage = (event) => {
      setMessage(event.data);
      devtool.dispatchEvent({
        type: 'PreactDevtools',
        data: event.data,
      });
    };
    devtool.addEventListener('eventname', handleMessage);
    setMessage('ready');
    return () => {
      devtool.removeEventListener('eventname', handleMessage);
    };
  }, []);

  return <text id='target'>{message}</text>;
}

root.render(<App />);
