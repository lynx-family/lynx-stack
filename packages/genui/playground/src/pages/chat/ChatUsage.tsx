// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { formatTokenCount } from './shared.js';
import {
  estimateTokenCost,
  formatEstimatedCost,
} from '../../utils/modelPricing.js';
import type { GenerationUsageRecord } from '../../utils/modelPricing.js';

const count = (value: number | undefined) =>
  value === undefined ? 'Not recorded' : formatTokenCount(value);

export function ChatUsage({ record }: { record: GenerationUsageRecord }) {
  const { usage, model, modelPrices } = record;
  const cost = estimateTokenCost(usage, modelPrices);
  const rates = modelPrices
    ? `${model}: input ¥${modelPrices.input_price}, cached ¥${modelPrices.cached_price}, output ¥${modelPrices.output_price} per 1K tokens`
    : `${model}: prices not recorded`;
  return (
    <span className='chatTokenUsageBadge' aria-label='Generation usage'>
      <span className='chatTokenUsageItem chatTokenUsageModel' title={model}>
        Model {model}
      </span>
      <span className='chatTokenUsageItem'>
        Prompt {count(usage.inputTokens)}
      </span>
      <span
        className='chatTokenUsageItem'
        title='Cache reads are included in Prompt and Total.'
      >
        Cached {count(usage.cachedTokens)}
        {usage.cachedTokens !== undefined && (usage.inputTokens ?? 0) > 0
          ? ` (${(usage.cachedTokens / usage.inputTokens! * 100).toFixed(1)}%)`
          : null}
      </span>
      {usage.cacheWriteTokens === undefined
        ? null
        : (
          <span className='chatTokenUsageItem'>
            Cache write {count(usage.cacheWriteTokens)}
          </span>
        )}
      <span className='chatTokenUsageItem'>
        Output {count(usage.outputTokens)}
      </span>
      <span className='chatTokenUsageItem chatTokenUsageTotal'>
        Total {count(usage.totalTokens)}
      </span>
      <span
        className='chatTokenUsageItem chatTokenUsageTotal'
        title={[
          'Estimated generation cost in CNY for this response, including repairs. Excludes image generation and search fees.',
          rates,
          ...(cost === undefined
            ? ['A required token count or model price was not recorded.']
            : []),
        ].join('\n')}
      >
        Est. cost {formatEstimatedCost(cost)}
      </span>
    </span>
  );
}
