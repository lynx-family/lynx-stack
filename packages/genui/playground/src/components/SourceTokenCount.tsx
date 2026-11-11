// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useSourceTokenCount } from '../hooks/useSourceTokenCount.js';

export function SourceTokenCount({ source, className }: {
  source: string;
  className?: string;
}) {
  const { count, pending } = useSourceTokenCount(source);
  return (
    <span
      className={className}
      role='status'
      aria-busy={pending}
      title='Token count of this source, including whitespace, using o200k_base. This is not model API usage.'
    >
      {pending
        ? 'Counting tokens…'
        : (count == null
          ? 'Tokens unavailable'
          : `${count.toLocaleString('en-US')} tokens`)}
    </span>
  );
}
