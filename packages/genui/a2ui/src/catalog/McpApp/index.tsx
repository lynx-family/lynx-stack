// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useMemo } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import {
  isWebPlatform,
  normalizeMcpAppHeight,
  resolveMcpAppBundleUrl,
} from './frame.js';
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/McpApp.css';

/**
 * Props for the built-in MCP App frame host.
 *
 * Bundle URLs and render data must come from a host-registered, trusted MCP
 * Apps resource. They must not be invented by an agent or accepted as
 * arbitrary executable content.
 *
 * @a2uiCatalog McpApp
 */
export interface McpAppProps extends GenericComponentProps {
  /** URL of the trusted native Lynx bundle that renders the MCP App. */
  url: string;
  /**
   * URL of the trusted Lynx for Web bundle. Web rendering uses this instead
   * of `url` and shows a fallback when it is omitted.
   */
  webUrl?: string;
  /** Renderer id, tool input, and validated result passed to the MCP App. */
  mcpAppData: Record<string, unknown>;
  /** Color theme passed to the nested Lynx page. */
  theme?: 'light' | 'dark';
  /** Let the frame follow the nested Lynx page's content width. */
  autoWidth?: boolean;
  /** Let the frame follow the nested Lynx page's content height. */
  autoHeight?: boolean;
  /** Frame height in pixels, or the preset height when autoHeight is true. */
  height?: number;
  /** Text shown when the platform-specific bundle URL is unavailable. */
  fallbackText?: string;
}

function McpAppFallback(props: { text: string }): ReactNode {
  return (
    <view className='a2ui-mcp-app-fallback'>
      <text className='a2ui-mcp-app-fallback-text'>{props.text}</text>
    </view>
  );
}

/** Render a trusted MCP App Lynx bundle inside a nested Lynx frame. */
export function McpApp(props: McpAppProps): ReactNode {
  const {
    url,
    webUrl,
    mcpAppData,
    theme = 'light',
    // autoWidth = true,
    autoHeight = true,
    fallbackText,
  } = props;
  const web = isWebPlatform();
  const bundleUrl = resolveMcpAppBundleUrl(web, url, webUrl);
  const height = normalizeMcpAppHeight(props.height);
  const frameStyle = autoHeight
    ? { width: '100%' }
    : { width: '100%', height: `${height}px` };
  const frameData = useMemo(
    () => ({
      embedded: true,
      mcpAppData,
      theme,
    }),
    [mcpAppData, theme],
  );

  if (bundleUrl.length === 0) {
    const defaultText = web
      ? 'Scan the native preview QR code on a mobile device to view this MCP App.'
      : 'MCP App content requires a trusted bundle URL.';
    return <McpAppFallback text={fallbackText ?? defaultText} />;
  }

  return (
    <view className='a2ui-mcp-app'>
      <frame
        key={props.id}
        className='a2ui-mcp-app-frame'
        src={bundleUrl}
        data={frameData}
        global-props={frameData}
        auto-height={autoHeight}
        preset-height={`${height}px`}
        style={frameStyle}
      />
    </view>
  );
}
