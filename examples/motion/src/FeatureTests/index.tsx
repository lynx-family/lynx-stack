// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

import FullFeatures from './full.js';
import MiniFeatures from './mini.js';
import ValuesExample from './values.js';
import './styles.css';

const suites = [
  { name: 'Full features', component: FullFeatures },
  { name: 'Mini features', component: MiniFeatures },
  { name: 'Motion values', component: ValuesExample },
];

export default function FeatureTests() {
  const [current, setCurrent] = useState(0);
  const Suite = suites[current]!.component;

  return (
    <view className='feature-tests'>
      <view className='feature-tabs'>
        {suites.map((suite, index) => (
          <view
            key={suite.name}
            className='feature-tab'
            bindtap={() => setCurrent(index)}
          >
            <text>{suite.name}</text>
          </view>
        ))}
      </view>
      <view className='feature-content'>
        <Suite />
      </view>
    </view>
  );
}

root.render(<FeatureTests />);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
