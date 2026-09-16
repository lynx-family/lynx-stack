// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState } from 'react';

import type { BenchResult } from './benchReportTypes.js';
import { Button } from '../../components/Button.js';
import { Copy } from '../../components/Icon.js';
import { copyToClipboard } from '../../utils/clipboard.js';

function savedArtifact(result: BenchResult): string | unknown[] | null {
  if (
    (result.protocol === 'a2ui' || result.protocol === undefined)
    && Array.isArray(result.messages) && result.messages.length > 0
  ) {
    return result.messages;
  }
  return typeof result.text === 'string' && result.text.trim().length > 0
    ? result.text
    : null;
}

export function BenchArtifactCopyButton(props: { result: BenchResult }) {
  const [copying, setCopying] = useState(false);
  const [notice, setNotice] = useState('');
  const artifact = savedArtifact(props.result);
  const label =
    `Copy artifact for ${props.result.scenarioName} · ${props.result.groupName} · #${
      props.result.repeatIndex ?? 1
    }`;

  async function copy() {
    if (artifact === null || copying) return;
    setCopying(true);
    setNotice('');
    const copied = await copyToClipboard(
      typeof artifact === 'string'
        ? artifact
        : JSON.stringify(artifact, null, 2),
    );
    setNotice(copied ? 'Copied.' : 'Copy failed. Please try again.');
    setCopying(false);
  }

  return (
    <span className='publishedReportArtifactAction' data-report-image-exclude>
      <Button
        variant='ghost'
        size='sm'
        iconBefore={Copy}
        responsiveIconOnly
        disabled={artifact === null || copying}
        aria-label={label}
        title={artifact === null
          ? 'No artifact was saved for this run.'
          : label}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void copy();
        }}
      >
        {copying ? 'Copying…' : 'Copy artifact'}
      </Button>
      {notice && <span role='status'>{notice}</span>}
    </span>
  );
}
