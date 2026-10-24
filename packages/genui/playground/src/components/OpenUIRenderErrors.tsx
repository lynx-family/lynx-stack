// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

import { formatOpenUIRenderErrors } from '../../lynx-src/openui/renderErrors.js';
import type { OpenUIRenderError } from '../../lynx-src/openui/renderErrors.js';
import { readOpenUIRenderErrorEvent } from '../utils/openuiRenderErrors.js';

import './OpenUIRenderErrors.css';

export function OpenUIRenderErrors({ frameSrc, containerRef }: {
  frameSrc: string;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [report, setReport] = useState<
    {
      frameSrc: string;
      errors: OpenUIRenderError[];
    } | null
  >(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      const frames = Array.from(
        containerRef.current?.querySelectorAll('iframe') ?? [],
      );
      const errors = readOpenUIRenderErrorEvent(event, frameSrc, frames);
      if (errors !== null) setReport({ frameSrc, errors });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [containerRef, frameSrc]);

  const errors = report?.frameSrc === frameSrc ? report.errors : [];
  if (errors.length === 0) return null;

  return (
    <details className='openuiRenderErrors' role='alert'>
      <summary>
        OpenUI preview reported {errors.length}{' '}
        {errors.length === 1 ? 'error' : 'errors'}
      </summary>
      <pre>{formatOpenUIRenderErrors(errors)}</pre>
    </details>
  );
}
