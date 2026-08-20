// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root } from '@lynx-js/preact-runtime';

function RecursiveText(props: { text: string }) {
  const { text } = props;
  const sliced = [...text];
  const [first, ...rest] = sliced;

  return (
    sliced.length > 0 && (
      <text>
        {first}
        <RecursiveText text={rest.join('')} />
      </text>
    )
  );
}

root.render(
  <>
    <RecursiveText text='Hello, preact-runtime 🎉!' />
    <view id='stop-benchmark-true' />
  </>,
);
