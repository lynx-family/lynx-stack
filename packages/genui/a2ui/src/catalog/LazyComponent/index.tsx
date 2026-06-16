// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Suspense, lazy, useMemo } from '@lynx-js/react';
import type { ComponentType, ReactNode } from '@lynx-js/react';

import type { GenericComponentProps } from '../../store/types.js';

type LazyComponentBundleProps = Record<string, unknown>;

function isWebPlatform(): boolean {
  return typeof SystemInfo !== 'undefined'
    && String(SystemInfo.platform) === 'web';
}

function LazyComponentFallback(props: { text: string }): ReactNode {
  return (
    <view
      style={{
        width: '100%',
        minHeight: '20px',
        padding: '6px',
        borderRadius: '6px',
        backgroundColor: 'var(--a2ui-color-surface-muted)',
      }}
    >
      <text style={{ fontSize: '10px', lineHeight: '12px' }}>
        {props.text}
      </text>
    </view>
  );
}

/**
 * @a2uiCatalog LazyComponent
 */
export interface LazyComponentProps extends GenericComponentProps {
  /**
   * URL of a ReactLynx standalone lazy bundle. The bundle must default-export
   * a React component. Used by native Lynx rendering.
   */
  url: string;
  /**
   * Optional URL of the web lazy bundle. Lynx for Web uses this instead of
   * `url`; when omitted, web rendering shows a fallback that asks the user to
   * scan the native preview QR code on a mobile device.
   */
  webUrl?: string;
  /**
   * Data passed to the lazy bundle component as `sourceData`.
   */
  sourceData?: Record<string, unknown> | Record<string, unknown>[];
  /**
   * Optional text shown while the lazy bundle is loading.
   */
  fallbackText?: string;
}

export function LazyComponent(props: LazyComponentProps): ReactNode {
  const {
    url,
    webUrl,
    sourceData,
    fallbackText = 'Loading lazy component content',
  } = props;
  const isWeb = isWebPlatform();
  const bundleUrl = isWeb
    ? (typeof webUrl === 'string' ? webUrl : '')
    : (typeof url === 'string' ? url : '');

  const LoadedComponent = useMemo(
    () =>
      lazy(() =>
        import(bundleUrl, { with: { type: 'component' } }) as Promise<
          { default: ComponentType<LazyComponentBundleProps> }
        >
      ),
    [bundleUrl],
  );

  if (isWeb && bundleUrl.length === 0) {
    return (
      <LazyComponentFallback text='Scan the native preview QR code on a mobile device to view this lazy component.' />
    );
  }

  if (bundleUrl.length === 0) {
    return (
      <LazyComponentFallback text='Lazy component content requires a url' />
    );
  }

  return (
    <Suspense fallback={<LazyComponentFallback text={fallbackText} />}>
      <LoadedComponent sourceData={sourceData} />
    </Suspense>
  );
}
