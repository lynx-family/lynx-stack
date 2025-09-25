// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

function RecursiveText(props: { text: string }) {
  const { text } = props;
  const sliced = [...text];
  const [first, ...rest] = sliced;
  
  for (let i = 0; i < 1e5; i++) {
    console.log('test')
  }

  return (
    sliced.length > 0 && (
      <text>
        {first}
        <RecursiveText text={rest.join('')} />
      </text>
    )
  );
}

export default RecursiveText;
