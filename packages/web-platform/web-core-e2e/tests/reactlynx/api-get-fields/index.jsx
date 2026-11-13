// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useEffect, useState } from '@lynx-js/react';

export function App() {
  const [results, setResults] = useState({});
  useEffect(() => {
    const save = name => (data, status) => {
      setResults(previous => ({ ...previous, [name]: { data, status } }));
    };
    lynx.createSelectorQuery().select('#target').fields(
      { id: true, dataset: true, tag: true },
      save('single'),
    ).exec();
    lynx.createSelectorQuery().selectAll('.target').fields(
      { id: true, tag: true, dataset: false },
      save('all'),
    ).exec();
    lynx.createSelectorQuery().select('#missing').fields(
      { id: true },
      save('missing'),
    ).exec();
    lynx.createSelectorQuery().selectAll('.missing').fields(
      { id: true },
      save('empty'),
    ).exec();
  }, []);

  return (
    <view>
      <text
        id='target'
        className='target'
        data-hello='world'
        data-count={0}
        data-enabled={false}
        data-detail={{ answer: 42 }}
      >
        Target
      </text>
      <view id='second' className='target' />
      <text id='results'>{JSON.stringify(results)}</text>
    </view>
  );
}

root.render(<App />);
