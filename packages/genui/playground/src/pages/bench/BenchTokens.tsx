// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { BenchTokenUsage } from './benchTokenUsage.js';

const numbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const format = (value: number | undefined) =>
  value === undefined || !Number.isFinite(value)
    ? 'Not recorded'
    : numbers.format(value);

export function BenchTokens(props: {
  tokens: number;
  usage: BenchTokenUsage;
  average?: boolean;
}) {
  const usage = props.usage;
  const rows: [string, string][] = [
    ['Total', format(props.tokens)],
    ['Input', format(usage.inputTokens)],
    ['Output', format(usage.outputTokens)],
    ['Cache read', format(usage.cachedTokens)],
    ['Cache write', format(usage.cacheWriteTokens)],
    ['Reasoning', format(usage.reasoningTokens)],
    [
      'Cache hit rate',
      usage.cachedTokens !== undefined && (usage.inputTokens ?? 0) > 0
        ? `${numbers.format(usage.cachedTokens / usage.inputTokens! * 100)}%`
        : 'Not recorded',
    ],
  ];
  return (
    <details className='benchTokenDetails'>
      <summary
        aria-label={`${props.average ? 'Average token' : 'Token'} details: ${
          format(props.tokens)
        }`}
        title={rows.map(([label, value]) => `${label}: ${value}`).join('\n')}
      >
        {format(props.tokens)}
      </summary>
      <div className='benchTokenBreakdown'>
        <strong>
          {props.average ? 'Average tokens per planned run' : 'Token details'}
        </strong>
        <dl>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p>Includes generation steps and repair attempts. Excludes UI Judge.</p>
        <p>
          Cache counts are part of input; reasoning is part of output. Missing
          usage is not recorded as zero.
        </p>
      </div>
    </details>
  );
}
