// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useUpdateBenchmarkCompletion } from './UpdateBenchmark.js';

const ITEM_IDS = Array.from({ length: 100 }, (_, index) => index);
const TARGET_ITEM_ID = 50;

interface UpdateBenchmarkProps {
  caseFilePath: string;
  readUpdated: () => boolean;
}

// Invoke the reader in this leaf so the signal variant subscribes here instead
// of rerendering the static parent tree.
function LocalAttributeUpdateTarget({
  caseFilePath,
  readUpdated,
}: UpdateBenchmarkProps) {
  const updated = readUpdated();
  const benchmarkFinished = useUpdateBenchmarkCompletion(
    caseFilePath,
    updated,
  );

  return (
    <view id={`stop-benchmark-${benchmarkFinished}`}>
      <view id={`target-${updated ? 'updated' : 'initial'}`} />
    </view>
  );
}

export function LocalAttributeUpdateBenchmark({
  caseFilePath,
  readUpdated,
}: UpdateBenchmarkProps) {
  return (
    <view>
      {ITEM_IDS.map(itemId =>
        itemId === TARGET_ITEM_ID
          ? (
            <LocalAttributeUpdateTarget
              key={itemId}
              caseFilePath={caseFilePath}
              readUpdated={readUpdated}
            />
          )
          : <view key={itemId} id={`static-${itemId}`} />
      )}
    </view>
  );
}

export function FullAttributeUpdateBenchmark({
  caseFilePath,
  readUpdated,
}: UpdateBenchmarkProps) {
  return (
    <view>
      {ITEM_IDS.map(itemId => (
        <FullAttributeUpdateItem
          key={itemId}
          itemId={itemId}
          readUpdated={readUpdated}
        />
      ))}
      <FullAttributeUpdateCompletion
        caseFilePath={caseFilePath}
        readUpdated={readUpdated}
      />
    </view>
  );
}

function FullAttributeUpdateItem({
  itemId,
  readUpdated,
}: {
  itemId: number;
  readUpdated: () => boolean;
}) {
  const updated = readUpdated();

  return (
    <view
      id={`full-attribute-${itemId}-${updated ? 'updated' : 'initial'}`}
    />
  );
}

function FullAttributeUpdateCompletion({
  caseFilePath,
  readUpdated,
}: UpdateBenchmarkProps) {
  const updated = readUpdated();
  const benchmarkFinished = useUpdateBenchmarkCompletion(
    caseFilePath,
    updated,
  );

  return <view id={`stop-benchmark-${benchmarkFinished}`} />;
}
