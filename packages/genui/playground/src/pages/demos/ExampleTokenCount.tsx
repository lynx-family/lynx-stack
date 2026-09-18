// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useState } from 'react';

export function ExampleTokenCount({ source }: { source: string }) {
  const [result, setResult] = useState<
    {
      source: string;
      count: number | null;
    } | null
  >(null);

  useEffect(() => {
    if (source === '') return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void import('gpt-tokenizer/encoding/o200k_base').then(
        ({ countTokens }) => {
          if (cancelled) return;
          setResult({
            source,
            // Token-like strings in example code are ordinary source text.
            count: countTokens(source, { disallowedSpecial: new Set() }),
          });
        },
      ).catch(() => {
        if (!cancelled) setResult({ source, count: null });
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [source]);

  const pending = source !== '' && result?.source !== source;
  const count = source === '' ? 0 : result?.count;

  return (
    <div
      className='exampleTokenCount'
      title='Token count of the original editor source, including whitespace, using o200k_base. This is not model API usage.'
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
