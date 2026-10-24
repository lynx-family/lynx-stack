// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useSourceTokenCount } from '../../hooks/useSourceTokenCount.js';

export function ExampleTokenCount({ source }: { source: string }) {
  const { count, pending } = useSourceTokenCount(source);

  return (
    <div
      className='exampleTokenCount'
      title='Token count of the currently displayed source, including whitespace, using o200k_base. This is not model API usage.'
    >
      <span
        className='exampleTokenCountMetric'
        role='status'
        aria-busy={pending}
      >
        {!pending && count != null
          ? (
            <>
              <strong className='exampleTokenCountValue'>
                {count.toLocaleString('en-US')}
              </strong>{' '}
              <span className='exampleTokenCountUnit'>tokens</span>
            </>
          )
          : (
            <span className='exampleTokenCountStatus'>
              {pending ? 'Counting tokens…' : 'Tokens unavailable'}
            </span>
          )}
      </span>
      <code className='exampleTokenCountEncoding'>o200k_base</code>
    </div>
  );
}
