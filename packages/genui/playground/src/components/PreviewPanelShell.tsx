// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { Button } from './Button.js';
import { Maximize2, Minimize2 } from './Icon.js';
import {
  PreviewPanelMetricsContext,
  PreviewPanelPreviewModeContext,
  PreviewPanelRenderContext,
} from './PreviewPanelContext.js';
import type {
  PreviewPanelMetricsContextValue,
  PreviewPanelRenderContextValue,
} from './PreviewPanelContext.js';

const EMPTY_RENDER_CONTEXT: PreviewPanelRenderContextValue = { renderUrl: '' };
const EMPTY_METRICS_CONTEXT: PreviewPanelMetricsContextValue = {
  metricId: '',
  onFrameSrcChange: () => undefined,
};

export interface PreviewPanelShellProps {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  title: ReactNode;
  headerAfterTitle?: ReactNode;
  showPreviewModeSwitch?: boolean;
  beforeBody?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
  afterBody?: ReactNode;
  previewInfoHint?: ReactNode;
}

function PreviewModeSwitch(props: {
  mode: 'phone' | 'full';
  onChange: (mode: 'phone' | 'full') => void;
}) {
  return (
    <div className='previewModeSwitch'>
      <button
        type='button'
        className={props.mode === 'phone'
          ? 'previewModeBtn active'
          : 'previewModeBtn'}
        onClick={() => props.onChange('phone')}
        title='Phone frame'
      >
        Phone
      </button>
      <button
        type='button'
        className={props.mode === 'full'
          ? 'previewModeBtn active'
          : 'previewModeBtn'}
        onClick={() => props.onChange('full')}
        title='Full panel'
      >
        Full
      </button>
    </div>
  );
}

/**
 * The transport-neutral visual shell of the hosted Preview panel. Hosted
 * sharing, QR, metrics, and render-URL behavior stay in PreviewPanel; local
 * callers use this shell so their credentialed control bundle cannot acquire
 * hosted runtime or publishing dependencies.
 */
export function PreviewPanelShell(props: PreviewPanelShellProps) {
  const [mode, setMode] = useState<'phone' | 'full'>('phone');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modeContext = useMemo(() => ({ mode, setMode }), [mode]);
  const bodyClassName = props.bodyClassName
    ?? (mode === 'full' || isFullscreen
      ? 'previewPanelBody previewPanelBodyFull'
      : 'previewPanelBody');
  const className = props.className
    ? `${props.className}${isFullscreen ? ' previewPanelFullscreen' : ''}`
    : (isFullscreen
      ? 'previewPanel previewPanelFullscreen'
      : 'previewPanel');
  const style = isFullscreen
    ? {
      position: 'fixed' as const,
      inset: 0,
      zIndex: 200,
      width: '100vw',
      height: '100vh',
    }
    : props.style;

  return (
    <PreviewPanelPreviewModeContext.Provider value={modeContext}>
      <PreviewPanelMetricsContext.Provider value={EMPTY_METRICS_CONTEXT}>
        <PreviewPanelRenderContext.Provider value={EMPTY_RENDER_CONTEXT}>
          <div className={className} style={style}>
            <div className='previewPanelHeader'>
              <span className='previewPanelTitle'>{props.title}</span>
              {props.headerAfterTitle}
              <div className='spacer' />
              {props.showPreviewModeSwitch
                ? <PreviewModeSwitch mode={mode} onChange={setMode} />
                : null}
              <Button
                variant='ghost'
                size='sm'
                iconOnly
                iconBefore={isFullscreen ? Minimize2 : Maximize2}
                className='previewExpandBtn'
                onClick={() => setIsFullscreen((value) => !value)}
                title={isFullscreen ? 'Exit fullscreen' : 'Expand preview'}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Expand preview'}
              />
            </div>
            {props.beforeBody}
            <div className={bodyClassName}>{props.children}</div>
            {props.previewInfoHint
              ? (
                <div className='previewQrSection previewQrSectionEmpty'>
                  <div className='previewQrEmptyState'>
                    <div className='previewQrEmptyTitle'>
                      Preview information
                    </div>
                    <div className='previewQrEmptyDesc'>
                      {props.previewInfoHint}
                    </div>
                  </div>
                </div>
              )
              : null}
            {props.afterBody}
          </div>
        </PreviewPanelRenderContext.Provider>
      </PreviewPanelMetricsContext.Provider>
    </PreviewPanelPreviewModeContext.Provider>
  );
}
