// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MobilePreview } from '../components/MobilePreview.js';
import { QrCode } from '../components/QrCode.js';
import {
  DYNAMIC_PRESETS,
  STATIC_DEMOS,
  componentsByMessage,
} from '../demos.js';
import { DEFAULT_DEMO_URL } from '../utils/demoUrl.js';
import type { ProtocolVersion } from '../utils/protocol.js';
import { buildRenderUrl } from '../utils/renderUrl.js';

interface Scenario {
  id: string;
  title: string;
  tags: string[];
  messages: unknown;
  actionMocks?: Record<string, unknown>;
}

const jsonExtensions = [json()];

function formatUrlForDisplay(url: string): string {
  // Keep it readable without changing the actual link we copy / QR.
  if (url.length <= 80) return url;
  const head = url.slice(0, 44);
  const tail = url.slice(-24);
  return `${head}…${tail}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const clipboard = window.navigator?.clipboard;
    if (!clipboard) return false;
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

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

const ALL_SCENARIOS: Scenario[] = [
  ...STATIC_DEMOS.map((d) => ({ ...d, actionMocks: undefined })),
  ...DYNAMIC_PRESETS,
];

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? [], null, 2);
}

export function DemosPage(props: { protocol: ProtocolVersion }) {
  const { protocol } = props;

  const [scenarioId, setScenarioId] = useState<string>(
    ALL_SCENARIOS[0]?.id ?? '',
  );
  const [customJson, setCustomJson] = useState<string>(() =>
    formatJson(ALL_SCENARIOS[0]?.messages)
  );
  const [error, setError] = useState('');
  const [renderUrl, setRenderUrl] = useState('');
  const [lynxDevUrl, setLynxDevUrl] = useState('');
  const [, setRenderQrError] = useState('');
  const [lynxDevQrError, setLynxDevQrError] = useState('');
  const [lynxDevCopied, setLynxDevCopied] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSimTooltip, setShowSimTooltip] = useState(false);
  const [jsonEdited, setJsonEdited] = useState(false);
  const [previewMode, setPreviewMode] = useState<'phone' | 'full'>(
    () => window.innerWidth <= 980 ? 'full' : 'phone',
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [liveComponents, setLiveComponents] = useState<string[]>([]);
  const liveTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const baseUrl = window.location.href.replace(/#.*$/, '');
  const rspeedyDevUrl = useRspeedyDevUrl();
  const lynxUrlSeqRef = useRef(0);

  // For QR codes, replace localhost/127.0.0.1 with the LAN IP so phones can reach it.
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

  const currentScenario = useMemo(
    () => ALL_SCENARIOS.find((s) => s.id === scenarioId) ?? ALL_SCENARIOS[0],
    [scenarioId],
  );

  // Whether the current render is a known demo (simulated) vs. custom JSON.
  const [isSimulated, setIsSimulated] = useState(true);

  const doRender = useCallback(
    (json: string, scenario: Scenario | undefined) => {
      setError('');
      setRenderQrError('');
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch (e) {
        setError(`Invalid JSON: ${String(e)}`);
        return;
      }
      const actionMocks = scenario?.actionMocks;
      // Use short demo ID only when the user hasn't edited the JSON.
      const isKnownDemo = !jsonEdited
        && ALL_SCENARIOS.some((s) => s.id === scenario?.id);
      setIsSimulated(isKnownDemo);
      const url = buildRenderUrl(
        {
          protocol,
          demoUrl: DEFAULT_DEMO_URL,
          messages: parsed,
          actionMocks,
          demoId: isKnownDemo ? scenario!.id : undefined,
          speed,
        },
        networkBaseUrl,
      );
      setRenderUrl(url);

      // Live component stack: reveal component names as they would appear
      // during streaming, synced with the replay speed.
      for (const t of liveTimersRef.current) clearTimeout(t);
      liveTimersRef.current = [];
      setLiveComponents([]);
      const perMsg = componentsByMessage(parsed);
      const delayMs = 800 / (speed || 1);
      let accumulated: string[] = [];
      perMsg.forEach((newNames, i) => {
        if (newNames.length === 0) return;
        const timer = setTimeout(() => {
          accumulated = [...accumulated, ...newNames];
          setLiveComponents([...accumulated]);
        }, delayMs * (i + 1));
        liveTimersRef.current.push(timer);
      });

      // On mobile, auto-expand preview to fullscreen when rendering.
      if (window.innerWidth <= 980) {
        setFullscreen(true);
      }

      // Native in-app preview: pass A2UI payload via global props, directly through URL query.
      // In Lynx, query params are exposed in `lynx.__globalProps` / `useGlobalProps()`.
      const seq = ++lynxUrlSeqRef.current;
      if (rspeedyDevUrl) {
        const uInline = new URL(rspeedyDevUrl);
        if (speed !== 1) {
          uInline.searchParams.set('speed', String(speed));
        }
        if (isKnownDemo) {
          // Known demo: point to the static JSON served by the rsbuild dev server.
          // Native Lynx supports fetch, so App.tsx will load it via messagesUrl.
          const demosOrigin = new URL(networkBaseUrl).origin;
          uInline.searchParams.set(
            'messagesUrl',
            `${demosOrigin}/demos/${scenario!.id}.json`,
          );
        } else {
          uInline.searchParams.set('messages', JSON.stringify(parsed));
          if (actionMocks) {
            uInline.searchParams.set(
              'actionMocks',
              JSON.stringify(actionMocks),
            );
          }
        }
        setLynxDevUrl(uInline.toString());
      } else {
        setLynxDevUrl('');
      }

      // Try to swap both URLs to short (reference-based) variants using the
      // rspeedy dev server's payload store. When available, both QR codes
      // become small enough to be scannable.
      void (async () => {
        if (!rspeedyDevUrl) return;
        try {
          const rspeedyOrigin = new URL(rspeedyDevUrl).origin;
          const res = await window.fetch(`${rspeedyOrigin}/__a2ui_payload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: parsed, actionMocks }),
          });
          if (!res.ok) return;
          const data = (await res.json()) as {
            messagesUrl?: string;
            actionMocksUrl?: string;
          };

          const messagesUrlAbs = typeof data.messagesUrl === 'string'
            ? `${rspeedyOrigin}${data.messagesUrl}`
            : undefined;
          const actionMocksUrlAbs = typeof data.actionMocksUrl === 'string'
            ? `${rspeedyOrigin}${data.actionMocksUrl}`
            : undefined;

          if (seq !== lynxUrlSeqRef.current) return;

          // Lynx dev bundle URL: drop inline messages, use references.
          const u = new URL(rspeedyDevUrl);
          if (messagesUrlAbs) u.searchParams.set('messagesUrl', messagesUrlAbs);
          if (actionMocksUrlAbs && actionMocks) {
            u.searchParams.set('actionMocksUrl', actionMocksUrlAbs);
          }
          u.searchParams.delete('messages');
          u.searchParams.delete('actionMocks');
          setLynxDevUrl(u.toString());

          // Web render URL: also swap to reference-based form so the
          // "View on Device" QR is scannable. render.html already supports
          // messagesUrl / actionMocksUrl query params.
          if (messagesUrlAbs) {
            const r = new URL('render.html', networkBaseUrl);
            r.searchParams.set('protocol', protocol);
            r.searchParams.set('demoUrl', DEFAULT_DEMO_URL);
            r.searchParams.set('messagesUrl', messagesUrlAbs);
            if (actionMocksUrlAbs && actionMocks) {
              r.searchParams.set('actionMocksUrl', actionMocksUrlAbs);
            }
            setRenderUrl(r.toString());
          }
        } catch {
          // If the payload store is unavailable, fall back to the inline URLs
          // already set above; QR may show "URL too long" in that case.
        }
      })();
    },
    [jsonEdited, networkBaseUrl, protocol, rspeedyDevUrl, speed],
  );

  useEffect(() => {
    if (ALL_SCENARIOS[0]) {
      const json = formatJson(ALL_SCENARIOS[0].messages);
      doRender(json, ALL_SCENARIOS[0]);
    }
  }, [doRender]);

  const handleSelectScenario = useCallback(
    (id: string) => {
      setScenarioId(id);
      setError('');
      setJsonEdited(false);
      const scenario = ALL_SCENARIOS.find((s) => s.id === id);
      if (scenario) {
        const json = formatJson(scenario.messages);
        setCustomJson(json);
        doRender(json, scenario);
      }
    },
    [doRender],
  );

  const handleRender = useCallback(() => {
    doRender(customJson, currentScenario);
  }, [customJson, currentScenario, doRender]);

  const handleFillExample = useCallback(() => {
    setError('');
    setJsonEdited(false);
    if (currentScenario) {
      const json = formatJson(currentScenario.messages);
      setCustomJson(json);
      doRender(json, currentScenario);
    }
  }, [currentScenario, doRender]);

  const handleClear = useCallback(() => {
    setCustomJson('[]');
    setRenderUrl('');
    setLynxDevUrl('');
    setRenderQrError('');
    setError('');
    setJsonEdited(false);
  }, []);

  return (
    <div className='demosPage'>
      {/* Sidebar */}
      <aside className='sidebar'>
        <div className='sidebarSection'>
          <div className='sidebarHeading'>Scenarios</div>
          <div className='scenarioList'>
            {ALL_SCENARIOS.map((s) => (
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

      {/* Code Panel */}
      <div className='codePanel'>
        <div className='codePanelToolbar'>
          <div className='codePanelTitle'>
            A2UI Messages
            <span className='codePanelBadge'>JSON</span>
          </div>
          <div className='spacer' />
          <div className='toolbarActions'>
            <button
              type='button'
              className='toolbarBtn'
              onClick={handleFillExample}
              title='Reset'
            >
              ↻ Reset
            </button>
            <button
              type='button'
              className='toolbarBtn'
              onClick={handleClear}
              title='Clear'
            >
              ✕ Clear
            </button>
            <button
              type='button'
              className='toolbarBtn primary'
              onClick={handleRender}
            >
              ▶ Render
            </button>
          </div>
        </div>
        <CodeMirror
          className='codeEditor'
          value={customJson}
          extensions={jsonExtensions}
          onChange={(v) => {
            setCustomJson(v);
            setJsonEdited(true);
          }}
          theme='dark'
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
          }}
        />
        {error ? <div className='codeError'>{error}</div> : null}
      </div>

      {/* Preview Panel */}
      <div
        className={fullscreen
          ? 'previewPanel previewPanelFullscreen'
          : 'previewPanel'}
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
        {isSimulated
          ? (
            <div className='simulationBar'>
              <div className='simInfo'>
                <button
                  type='button'
                  className='simInfoToggle'
                  onClick={() => setShowSimTooltip((v) => !v)}
                  aria-label='Simulation info'
                >
                  <span className='simInfoIcon'>i</span>
                  <span className='simInfoLabel'>Simulated</span>
                </button>
                {showSimTooltip
                  ? (
                    <div className='simTooltip'>
                      Pre-recorded messages replayed at simulated speed. No AI
                      model is running.
                    </div>
                  )
                  : null}
              </div>
              <div className='simSpeed'>
                <label className='simSpeedLabel' htmlFor='speedSlider'>
                  Speed
                </label>
                <input
                  id='speedSlider'
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
          )
          : null}
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
                <div>Select a scenario and click Render</div>
                <div className='previewEmptySub'>
                  Or edit the JSON and press ▶ Render
                </div>
              </div>
            )}
        </div>

        {/* Live Component Stack */}
        {liveComponents.length > 0
          ? (
            <div className='liveComponentStack'>
              <span className='liveComponentLabel'>Components</span>
              <div className='liveComponentTags'>
                {liveComponents.map((name) => (
                  <span key={name} className='liveComponentTag'>{name}</span>
                ))}
              </div>
            </div>
          )
          : null}

        {/* QR Code Section — only shown when there's a render URL */}
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
