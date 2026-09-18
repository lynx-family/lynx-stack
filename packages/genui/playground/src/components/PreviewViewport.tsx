// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';

import { HtmlView } from './HtmlView.js';
import { LynxXmlView } from './LynxXmlView.js';
import {
  PreviewPanelMetricsContext,
  PreviewPanelPreviewModeContext,
  PreviewPanelRenderContext,
} from './PreviewPanel.js';
import type { PreviewMode } from './PreviewPanel.js';
import {
  RENDER_METRIC_ID_QUERY_PARAM,
  RENDER_NAVIGATION_TOKEN_QUERY_PARAM,
} from '../utils/renderUrl.js';

interface PreviewViewportProps {
  src?: string;
  htmlSource?: string;
  lynxXmlSource?: string;
  iframeTitle?: string;
  iframeRef?: Ref<HTMLIFrameElement>;
  onLoad?: () => void;
  displayMode?: PreviewMode;
  /**
   * Keep the previous frame visible while a new `src` is loading, so
   * reload-based transitions don't flash an intermediate loading state.
   */
  retainPreviousFrame?: boolean;
  emptyIcon?: ReactNode;
  emptyTitle: ReactNode;
  emptySubTitle?: ReactNode;
}

function PhoneShell(props: { children: ReactNode }) {
  const { children } = props;
  return (
    <div className='phoneWrap'>
      <div className='phoneFrame'>
        <div className='phoneStatusBar'>
          <span className='phoneStatusTime'>9:41</span>
          <div className='phoneStatusIcons' aria-hidden='true'>
            <span className='phoneSignal' />
            <span className='phoneWifi' />
            <span className='phoneBattery'>
              <span className='phoneBatteryFill' />
            </span>
          </div>
        </div>
        <div className='phoneChrome'>
          <div className='phoneNotch' aria-hidden='true' />
        </div>
        <div className='phoneScreen'>{children}</div>
        <div className='phoneHomeIndicator' />
      </div>
    </div>
  );
}

let nextPreviewNavigationToken = 0;

function createPreviewNavigationToken(navigationKey: string): string {
  nextPreviewNavigationToken += 1;
  return `${Date.now().toString(36)}-${
    nextPreviewNavigationToken.toString(36)
  }-${navigationKey.length.toString(36)}`;
}

function withPreviewFrameMetadata(
  src: string,
  metricId: string,
  navigationToken: string,
): string {
  if (!src) return src;

  try {
    const url = new URL(src, window.location.href);
    if (!url.pathname.endsWith('/render.html')) return src;
    if (metricId) {
      url.searchParams.set(RENDER_METRIC_ID_QUERY_PARAM, metricId);
    }
    url.searchParams.set(
      RENDER_NAVIGATION_TOKEN_QUERY_PARAM,
      navigationToken,
    );
    return url.toString();
  } catch {
    return src;
  }
}

export function PreviewViewport(props: PreviewViewportProps) {
  const {
    emptyIcon = '▶',
    emptySubTitle,
    emptyTitle,
    htmlSource: htmlSourceProp,
    iframeTitle = 'preview',
    iframeRef,
    lynxXmlSource: lynxXmlSourceProp,
    displayMode,
    onLoad,
    src,
    retainPreviousFrame = false,
  } = props;
  const [displayedSrc, setDisplayedSrc] = useState<string>('');
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const pendingSrcRef = useRef<string | null>(null);
  const previewModeContext = useContext(PreviewPanelPreviewModeContext);
  const previewRenderContext = useContext(PreviewPanelRenderContext);
  const previewMetricsContext = useContext(PreviewPanelMetricsContext);
  const mode: PreviewMode = displayMode ?? previewModeContext?.mode ?? 'phone';
  const htmlSource = htmlSourceProp ?? previewRenderContext?.htmlSource;
  const lynxXmlSource = lynxXmlSourceProp
    ?? previewRenderContext?.lynxXmlSource;
  const rawResolvedSrc = src ?? previewRenderContext?.renderUrl ?? '';
  const metricId = previewMetricsContext?.metricId ?? '';
  const navigationToken = useMemo(
    () => createPreviewNavigationToken(`${metricId}\0${rawResolvedSrc}`),
    [metricId, rawResolvedSrc],
  );
  const resolvedSrc = useMemo(
    () =>
      withPreviewFrameMetadata(
        rawResolvedSrc,
        metricId,
        navigationToken,
      ),
    [metricId, navigationToken, rawResolvedSrc],
  );

  useEffect(() => {
    previewMetricsContext?.onFrameSrcChange(resolvedSrc);
  }, [previewMetricsContext, resolvedSrc]);

  useEffect(() => {
    pendingSrcRef.current = pendingSrc;
  }, [pendingSrc]);

  useEffect(() => {
    if (!retainPreviousFrame) {
      setDisplayedSrc(resolvedSrc);
      setPendingSrc(null);
      return;
    }

    if (!resolvedSrc) {
      setDisplayedSrc('');
      setPendingSrc(null);
      return;
    }

    if (!displayedSrc) {
      setDisplayedSrc(resolvedSrc);
      setPendingSrc(null);
      return;
    }

    if (displayedSrc === resolvedSrc) {
      if (pendingSrc) setPendingSrc(null);
      return;
    }

    setPendingSrc(resolvedSrc);
  }, [displayedSrc, pendingSrc, retainPreviousFrame, resolvedSrc]);

  const activeSrc = retainPreviousFrame ? displayedSrc : resolvedSrc;

  const showTransitionLayer = retainPreviousFrame && pendingSrc !== null;

  const renderFrame = (
    frameSrc: string,
    className: string,
    extraProps?: {
      key?: string;
      ref?: Ref<HTMLIFrameElement>;
      onLoad?: () => void;
    },
  ) => (
    <iframe
      key={extraProps?.key}
      className={className}
      ref={extraProps?.ref}
      title={iframeTitle}
      src={frameSrc}
      onLoad={extraProps?.onLoad}
    />
  );

  if (htmlSource !== undefined) {
    const htmlView = (
      <HtmlView
        className={mode === 'phone' ? 'phoneIframe' : 'previewFullIframe'}
        iframeRef={iframeRef}
        source={htmlSource}
        title={iframeTitle}
        onLoad={onLoad}
      />
    );

    return mode === 'phone'
      ? <PhoneShell>{htmlView}</PhoneShell>
      : <div className='previewFullFrame'>{htmlView}</div>;
  }

  if (lynxXmlSource) {
    const lynxXmlView = (
      <LynxXmlView
        className={mode === 'phone' ? 'phoneIframe' : 'previewFullIframe'}
        source={lynxXmlSource}
        onLoad={onLoad}
      />
    );

    return mode === 'phone'
      ? <PhoneShell>{lynxXmlView}</PhoneShell>
      : <div className='previewFullFrame'>{lynxXmlView}</div>;
  }

  if (mode === 'phone') {
    if (!activeSrc) {
      return (
        <PhoneShell>
          <div className='phoneEmptyState'>
            <div className='phoneEmptyIcon'>{emptyIcon}</div>
            <div className='phoneEmptyTitle'>{emptyTitle}</div>
            {emptySubTitle
              ? <div className='phoneEmptySub'>{emptySubTitle}</div>
              : null}
          </div>
        </PhoneShell>
      );
    }

    return (
      <PhoneShell>
        {showTransitionLayer
          ? (
            <div className='previewFrameStack'>
              {renderFrame(activeSrc, 'phoneIframe previewFrameLayer', {
                key: 'active',
                ref: iframeRef,
              })}
              {pendingSrc
                ? renderFrame(
                  pendingSrc,
                  'phoneIframe previewFrameLayer previewFramePending',
                  {
                    key: 'pending',
                    onLoad: () => {
                      if (pendingSrcRef.current !== pendingSrc) return;
                      setDisplayedSrc(pendingSrc);
                      setPendingSrc(null);
                      onLoad?.();
                    },
                  },
                )
                : null}
            </div>
          )
          : renderFrame(
            activeSrc,
            'phoneIframe',
            {
              ref: iframeRef,
              onLoad,
            },
          )}
      </PhoneShell>
    );
  }

  if (!activeSrc) {
    return (
      <div className='previewEmpty'>
        <div className='previewEmptyIcon'>{emptyIcon}</div>
        <div>{emptyTitle}</div>
        {emptySubTitle
          ? <div className='previewEmptySub'>{emptySubTitle}</div>
          : null}
      </div>
    );
  }

  return showTransitionLayer
    ? (
      <div className='previewFullFrame previewFrameStack'>
        {renderFrame(activeSrc, 'previewFullIframe previewFrameLayer', {
          key: 'active',
          ref: iframeRef,
        })}
        {pendingSrc
          ? renderFrame(
            pendingSrc,
            'previewFullIframe previewFrameLayer previewFramePending',
            {
              key: 'pending',
              onLoad: () => {
                if (pendingSrcRef.current !== pendingSrc) return;
                setDisplayedSrc(pendingSrc);
                setPendingSrc(null);
                onLoad?.();
              },
            },
          )
          : null}
      </div>
    )
    : (
      <div className='previewFullFrame'>
        {renderFrame(activeSrc, 'previewFullIframe', {
          ref: iframeRef,
          onLoad,
        })}
      </div>
    );
}
