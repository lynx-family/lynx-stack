// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root } from '@lynx-js/react';

import { RunBenchmarkUntilHydrate } from '../../src/RunBenchmarkUntil.js';

function F(props: { text: string }) {
  const { text } = props;
  const sliced = [...text];
  const [first, ...rest] = sliced;

  return (
    sliced.length > 0 && (
      <text>
        {first}
        <F text={rest.join('')} />
      </text>
    )
  );
}

root.render(
  <>
    <F text='Hello, ReactLynx 🎉!' />
    <RunBenchmarkUntilHydrate />
  </>,
);
