// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useGlobalProps, useMemo } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import { readAppMarkdown } from './data.js';
import type { AppRendererRegistry } from './registry.js';
import './styles.css';

const MARKDOWN_STYLE = JSON.stringify({
  normalText: {
    color: '172033',
    fontSize: 16,
    lineHeight: 24,
  },
  link: {
    color: '2563eb',
  },
  inlineCode: {
    color: '7c3aed',
    backgroundColor: 'f1f5f9',
  },
  codeBlock: {
    color: 'e2e8f0',
    backgroundColor: '172033',
  },
});

/** Props for the protocol-agnostic MCP Apps Lynx host. */
export interface McpAppsProps {
  registry: AppRendererRegistry;
}

/**
 * Renders validated local MCP Apps data and falls back to streaming Markdown
 * when no registered renderer matches the supplied global data.
 */
export function McpApps(props: McpAppsProps) {
  const globalProps = useGlobalProps() as Record<string, unknown> | null;
  const renderData = useMemo(
    () => props.registry.resolveRenderData(globalProps?.['mcpAppData']),
    [globalProps, props.registry],
  );
  const markdown = useMemo(
    () => readAppMarkdown(globalProps?.['mcpAppData']),
    [globalProps],
  );

  const theme = globalProps?.['theme'] === 'dark' ? 'dark' : 'light';
  const rootClassName = theme === 'dark'
    ? 'appPage appPageDark'
    : 'appPage appPageLight';
  const Renderer = renderData?.renderer.component;
  let content: ReactNode;

  if (renderData && Renderer) {
    content = (
      <Renderer
        input={renderData.input}
        result={renderData.result}
      />
    );
  } else if (markdown) {
    content = (
      <view className='appMarkdown'>
        {/* @ts-expect-error x-markdown JSX types are not available yet. */}
        <x-markdown
          className='appMarkdownContent'
          content={markdown}
          markdown-style={MARKDOWN_STYLE}
          animation-type='typewriter'
          animation-velocity='60'
          content-complete='true'
          typewriter-dynamic-height='true'
        />
      </view>
    );
  } else {
    content = (
      <view className='appEmpty'>
        <text className='appEmptyTitle'>App data unavailable</text>
        <text className='appEmptyText'>
          The selected renderer needs a valid API result.
        </text>
      </view>
    );
  }

  return (
    <view className={rootClassName}>
      {content}
    </view>
  );
}
