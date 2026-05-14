// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';

import {
  PreviewPanelPreviewModeContext,
  PreviewPanelRenderContext,
} from './PreviewPanel.js';
import type { PreviewMode } from './PreviewPanel.js';

interface PreviewViewportProps {
  src?: string;
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

export function PreviewViewport(props: PreviewViewportProps) {
  const {
    emptyIcon = '▶',
    emptySubTitle,
    emptyTitle,
    iframeTitle = 'preview',
    iframeRef,
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
  const mode: PreviewMode = displayMode ?? previewModeContext?.mode ?? 'phone';
  const resolvedSrc = src ?? previewRenderContext?.renderUrl ?? '';

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
