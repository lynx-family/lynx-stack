// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ParseResult } from '@openuidev/lang-core';

import { OpenUiRenderer } from '@lynx-js/genui/openui';
import type {
  OpenUIError,
  OpenUiRendererRuntimeProps,
} from '@lynx-js/genui/openui';
import { memo, useCallback, useEffect, useMemo, useRef } from '@lynx-js/react';

import { splitOpenUiResponse } from './inlineResponse.js';
import { Markdown } from './Markdown/index.jsx';

type ReportBlockErrors = (id: string, errors: OpenUIError[]) => void;

const OpenUiBlock = memo(function OpenUiBlock(
  { blockId, reportErrors, onParseResult, ...props }:
    & OpenUiRendererRuntimeProps
    & {
      blockId: string;
      reportErrors?: ReportBlockErrors;
    },
) {
  const parsedRef = useRef<ParseResult | null>(null);
  const reportedToRef = useRef(onParseResult);
  const reportParse = useCallback((result: ParseResult | null) => {
    parsedRef.current = result;
    reportedToRef.current = onParseResult;
    onParseResult?.(result);
  }, [onParseResult]);
  useEffect(() => {
    // The outer source can advance while this completed block stays unchanged.
    // Reuse its parse result for the new host callback without parsing it again.
    if (reportedToRef.current === onParseResult) return;
    reportedToRef.current = onParseResult;
    onParseResult?.(parsedRef.current);
  }, [onParseResult]);
  const onError = useCallback((errors: OpenUIError[]) => {
    reportErrors?.(blockId, errors);
  }, [blockId, reportErrors]);
  useEffect(() => () => reportErrors?.(blockId, []), [blockId, reportErrors]);
  return (
    <OpenUiRenderer
      {...props}
      onParseResult={reportParse}
      {...(reportErrors ? { onError } : {})}
    />
  );
});

/** Render ordinary Markdown and independent OpenUI programs in response order. */
export function InlineOpenUiRenderer(
  { response, isStreaming = false, onError, ...props }:
    OpenUiRendererRuntimeProps,
) {
  const parts = useMemo(
    () => splitOpenUiResponse(response ?? '', isStreaming),
    [response, isStreaming],
  );
  const errorsByBlock = useRef(new Map<string, OpenUIError[]>());
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const reportErrors = useCallback<ReportBlockErrors>((id, errors) => {
    if (errors.length > 0) errorsByBlock.current.set(id, errors);
    else errorsByBlock.current.delete(id);
    onErrorRef.current?.([...errorsByBlock.current.values()].flat());
  }, []);

  return (
    <view className='OpenUIInlineResponse'>
      {parts.map((part, index) => {
        const id = `${part.kind}-${index}`;
        if (part.kind === 'text') {
          return part.content.trim()
            ? <Markdown key={id} content={part.content} />
            : null;
        }
        return (
          <OpenUiBlock
            key={id}
            {...props}
            blockId={id}
            response={part.content}
            isStreaming={isStreaming && part.complete === false}
            {...(onError ? { reportErrors } : {})}
          />
        );
      })}
    </view>
  );
}
