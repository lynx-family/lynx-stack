// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MobilePreview } from '../components/MobilePreview.js';
import { QrCode } from '../components/QrCode.js';
import { useResizablePanels } from '../hooks/useResizablePanels.js';
import { OPENUI_SCENARIOS } from '../mock/openui-scenarios.js';
import { copyToClipboard } from '../utils/clipboard.js';
import type { Protocol } from '../utils/protocol.js';

type CodeView = 'raw' | 'parsed';

const DESKTOP_PREVIEW_MIN_WIDTH = 320;
const DESKTOP_CODE_MIN_WIDTH = 360;
const COMPACT_CODE_MIN_HEIGHT = 220;
const COMPACT_PREVIEW_MIN_HEIGHT = 320;
const RESIZE_BREAKPOINT = 980;

function useRspeedyDevUrl(): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await window.fetch('/__rspeedy_url', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { url?: string };
        if (!cancelled && typeof data.url === 'string') {
          setUrl(data.url);
        }
      } catch {
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return url;
}

function formatUrlForDisplay(url: string): string {
  if (url.length <= 80) return url;
  const head = url.slice(0, 44);
  const tail = url.slice(-24);
  return `${head}…${tail}`;
}

function buildOpenUIRenderUrl(
  rawText: string,
  baseUrl: string,
  speed: number,
): string {
  const url = new URL('render.html', baseUrl);
  url.searchParams.set('protocol', 'openui');
  url.searchParams.set('demoUrl', './openui.web.js');
  url.searchParams.set('rawText', rawText);
  if (speed !== 1) {
    url.searchParams.set('speed', String(speed));
  }
  return url.toString();
}

export function OpenUIDemosPage(_props: { protocol: Protocol }) {
  const [codeView, setCodeView] = useState<CodeView>('raw');
  const [scenarioId, setScenarioId] = useState<string>(
    OPENUI_SCENARIOS[0]?.id ?? '',
  );
  const [renderUrl, setRenderUrl] = useState('');
  const [lynxDevUrl, setLynxDevUrl] = useState('');
  const [lynxDevCopied, setLynxDevCopied] = useState(false);
  const [, setRenderQrError] = useState('');
  const [lynxDevQrError, setLynxDevQrError] = useState('');
  const [speed, setSpeed] = useState(1);
  const [previewMode, setPreviewMode] = useState<'phone' | 'full'>(
    () => window.innerWidth <= 980 ? 'full' : 'phone',
  );
  const [fullscreen, setFullscreen] = useState(false);

  const {
    containerRef: pageRef,
    handleResizeStart: handlePanelResizeStart,
    isCompactLayout,
    isResizing: isPanelResizing,
    primaryPanelStyle: codePanelStyle,
    secondaryPanelStyle: previewPanelStyle,
  } = useResizablePanels({
    breakpoint: RESIZE_BREAKPOINT,
    compactOffsetSelector: '.sidebar',
    compactPrimaryMinSize: COMPACT_CODE_MIN_HEIGHT,
    compactSecondaryMinSize: COMPACT_PREVIEW_MIN_HEIGHT,
    desktopOffsetSelector: '.sidebar',
    desktopPrimaryMinSize: DESKTOP_CODE_MIN_WIDTH,
    desktopSecondaryMinSize: DESKTOP_PREVIEW_MIN_WIDTH,
    disabled: fullscreen,
    initialPrimarySize: 320,
    initialSecondarySize: 420,
  });

  const baseUrl = window.location.href.replace(/#.*$/, '');
  const rspeedyDevUrl = useRspeedyDevUrl();
  const lynxUrlSeqRef = useRef(0);

  const networkBaseUrl = useMemo(() => {
    const u = new URL(baseUrl);
    if (
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
      && rspeedyDevUrl
    ) {
      try {
        u.hostname = new URL(rspeedyDevUrl).hostname;
      } catch { /* ignore */ }
    }
    return u.toString();
  }, [baseUrl, rspeedyDevUrl]);

  const currentScenario = OPENUI_SCENARIOS.find((s) => s.id === scenarioId)
    ?? OPENUI_SCENARIOS[0];

  const doRender = useCallback(
    (rawText: string) => {
      const url = buildOpenUIRenderUrl(rawText, networkBaseUrl, speed);
      setRenderUrl(url);

      // Native Lynx dev URL
      const seq = ++lynxUrlSeqRef.current;
      if (rspeedyDevUrl) {
        const u = new URL(rspeedyDevUrl);
        // rspeedyDevUrl points to the default entry (a2ui.lynx), swap to openui entry
        u.pathname = u.pathname.replace('a2ui.lynx', 'openui.lynx');
        u.searchParams.set('rawText', rawText);
        if (speed !== 1) {
          u.searchParams.set('speed', String(speed));
        }
        setLynxDevUrl(u.toString());
      } else {
        setLynxDevUrl('');
      }

      // On mobile, auto-expand preview
      if (window.innerWidth <= 980) {
        setFullscreen(true);
      }

      void seq; // suppress unused warning
    },
    [networkBaseUrl, rspeedyDevUrl, speed],
  );

  // Auto-render the first scenario on mount
  useEffect(() => {
    if (currentScenario) {
      doRender(currentScenario.raw);
    }
  }, [doRender, currentScenario]);

  const handleSelectScenario = useCallback((id: string) => {
    setScenarioId(id);
  }, []);

  const handleRender = useCallback(() => {
    if (currentScenario) {
      doRender(currentScenario.raw);
    }
  }, [currentScenario, doRender]);

  return (
    <div
      ref={pageRef}
      className={isPanelResizing ? 'demosPage resizing' : 'demosPage'}
    >
      {/* Sidebar: Scenarios */}
      <aside className='sidebar'>
        <div className='sidebarSection'>
          <div className='sidebarHeading'>Scenarios</div>
          <div className='scenarioList'>
            {OPENUI_SCENARIOS.map((s) => (
              <button
                key={s.id}
                type='button'
                className={s.id === scenarioId
                  ? 'scenarioItem active'
                  : 'scenarioItem'}
                onClick={() => handleSelectScenario(s.id)}
              >
                <span className='scenarioName'>{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Code Panel: RAW OUTPUT / PARSED JSON */}
      <div className='codePanel' style={codePanelStyle}>
        <div className='codePanelToolbar'>
          <div className='codePanelTitle'>
            OpenUI Output
          </div>
          <div className='spacer' />
          <div className='previewModeSwitch'>
            <button
              type='button'
              className={codeView === 'raw'
                ? 'previewModeBtn active'
                : 'previewModeBtn'}
              onClick={() => setCodeView('raw')}
            >
              Raw Output
            </button>
            <button
              type='button'
              className={codeView === 'parsed'
                ? 'previewModeBtn active'
                : 'previewModeBtn'}
              onClick={() => setCodeView('parsed')}
            >
              Parsed JSON
            </button>
          </div>
          <div className='toolbarActions'>
            <button
              type='button'
              className='toolbarBtn primary'
              onClick={handleRender}
            >
              ▶ Render
            </button>
          </div>
        </div>
        <div className='codeEditor' style={{ flex: 1, overflow: 'auto' }}>
          {currentScenario
            ? (
              <pre
                style={{
                  margin: 0,
                  padding: 16,
                  fontSize: 13,
                  lineHeight: 1.6,
                  fontFamily: 'var(--geist-mono)',
                  color: 'var(--geist-code-fg)',
                  background: 'var(--geist-code-bg)',
                  height: '100%',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {codeView === 'raw'
                  ? currentScenario.raw
                  : currentScenario.parsed}
              </pre>
            )
            : (
              <div
                className='previewEmpty'
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                }}
              >
                <div>Select a scenario</div>
              </div>
            )}
        </div>
      </div>

      {fullscreen
        ? null
        : (
          <div
            className={isPanelResizing
              ? 'panelResizeHandle active'
              : 'panelResizeHandle'}
            role='separator'
            aria-orientation={isCompactLayout ? 'horizontal' : 'vertical'}
            aria-label='Resize examples and preview panels'
            title='Drag to resize'
            onPointerDown={handlePanelResizeStart}
          />
        )}

      {/* Preview Panel: Lynx Preview */}
      <div
        className={fullscreen
          ? 'previewPanel previewPanelFullscreen'
          : 'previewPanel'}
        style={previewPanelStyle}
      >
        <div className='previewPanelHeader'>
          <span className='previewPanelTitle'>Lynx Preview</span>
          <div className='spacer' />
          <div className='previewModeSwitch'>
            <button
              type='button'
              className={previewMode === 'phone'
                ? 'previewModeBtn active'
                : 'previewModeBtn'}
              onClick={() => setPreviewMode('phone')}
              title='Phone frame'
            >
              Phone
            </button>
            <button
              type='button'
              className={previewMode === 'full'
                ? 'previewModeBtn active'
                : 'previewModeBtn'}
              onClick={() => setPreviewMode('full')}
              title='Full panel'
            >
              Full
            </button>
          </div>
          <button
            type='button'
            className='previewExpandBtn'
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? 'Exit fullscreen' : 'Expand preview'}
          >
            {fullscreen ? '\u2715' : '\u2922'}
          </button>
        </div>

        {/* Simulation Speed */}
        <div className='simulationBar'>
          <div className='simInfo'>
            <span className='simInfoIcon'>i</span>
            <span className='simInfoLabel'>Simulated</span>
          </div>
          <div className='simSpeed'>
            <label className='simSpeedLabel' htmlFor='openui-speedSlider'>
              Speed
            </label>
            <input
              id='openui-speedSlider'
              className='simSpeedSlider'
              type='range'
              min='0.25'
              max='4'
              step='0.25'
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
            <span className='simSpeedValue'>{speed}x</span>
          </div>
        </div>

        <div
          className={previewMode === 'full'
            ? 'previewPanelBody previewPanelBodyFull'
            : 'previewPanelBody'}
        >
          {renderUrl
            ? (
              previewMode === 'phone'
                ? <MobilePreview src={renderUrl} />
                : (
                  <iframe
                    className='previewFullIframe'
                    title='preview'
                    src={renderUrl}
                  />
                )
            )
            : (
              <div className='previewEmpty'>
                <div className='previewEmptyIcon'>▶</div>
                <div>Select a scenario to preview</div>
                <div className='previewEmptySub'>
                  Lynx rendering will appear here
                </div>
              </div>
            )}
        </div>

        {/* QR Code Section */}
        {renderUrl || lynxDevUrl
          ? (
            <div className='previewQrSection'>
              {renderUrl
                ? (
                  <div className='previewQrContent'>
                    <div className='previewQrInfo'>
                      <div className='previewQrTitle'>Web Preview</div>
                      <div className='previewQrDesc'>
                        Opens in any mobile browser via Lynx for Web.
                      </div>
                      <div className='previewQrUrlRow'>
                        <div
                          className='previewQrUrlText'
                          title={renderUrl}
                        >
                          {formatUrlForDisplay(renderUrl)}
                        </div>
                        <button
                          type='button'
                          className='previewQrCopyBtn'
                          aria-label='Copy render URL'
                          title='Copy URL'
                          onClick={() => {
                            void copyToClipboard(renderUrl);
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <QrCode
                      value={renderUrl}
                      size={80}
                      onErrorChange={setRenderQrError}
                    />
                  </div>
                )
                : null}
              {lynxDevUrl
                ? (
                  <div className='previewQrContent previewQrContentAlt'>
                    <div className='previewQrInfo'>
                      <div className='previewQrTitle'>Native Preview</div>
                      <div className='previewQrDesc'>
                        {lynxDevQrError
                          ? 'URL too long for QR. Copy the link and open it in LynxExplorer.'
                          : 'Opens in LynxExplorer for native rendering.'}
                      </div>
                      <div className='previewQrUrlRow'>
                        <div
                          className='previewQrUrlText'
                          title={lynxDevUrl}
                        >
                          {formatUrlForDisplay(lynxDevUrl)}
                        </div>
                        <button
                          type='button'
                          className='previewQrCopyBtn'
                          aria-label='Copy Lynx dev bundle URL'
                          title={lynxDevCopied ? 'Copied' : 'Copy URL'}
                          onClick={() => {
                            void copyToClipboard(lynxDevUrl).then((ok) => {
                              if (!ok) return;
                              setLynxDevCopied(true);
                              window.setTimeout(
                                () => setLynxDevCopied(false),
                                1200,
                              );
                            });
                          }}
                        >
                          {lynxDevCopied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <QrCode
                      value={lynxDevUrl}
                      size={80}
                      onErrorChange={setLynxDevQrError}
                    />
                  </div>
                )
                : null}
            </div>
          )
          : null}
      </div>
    </div>
  );
}
