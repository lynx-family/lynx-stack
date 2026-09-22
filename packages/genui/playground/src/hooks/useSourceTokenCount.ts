// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useState } from 'react';

/** Count displayed source lazily, keeping tokenization out of streaming renders. */
export function useSourceTokenCount(source: string) {
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
            // Special-token spellings in generated code are ordinary source text.
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

  return {
    pending: source !== '' && result?.source !== source,
    count: source === ''
      ? 0
      : (result?.source === source ? result.count : undefined),
  };
}
