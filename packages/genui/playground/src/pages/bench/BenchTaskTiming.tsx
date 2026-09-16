// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { formatBenchDuration } from './benchTiming.js';

function timestamp(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
  return <time dateTime={value}>{new Date(value).toLocaleString('en-US')}
  </time>;
}

export function BenchTaskTiming(props: {
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}) {
  return (
    <dl className='benchTaskTiming' aria-label='Bench task timing'>
      <div title='Includes generation, queueing, screenshots, and UI Judge.'>
        <dt>Total time</dt>
        <dd>{formatBenchDuration(props.durationMs)}</dd>
      </div>
      <div>
        <dt>Started</dt>
        <dd>{timestamp(props.startedAt)}</dd>
      </div>
      <div>
        <dt>Finished</dt>
        <dd>{timestamp(props.completedAt)}</dd>
      </div>
    </dl>
  );
}
