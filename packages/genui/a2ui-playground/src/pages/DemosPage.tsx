// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Chip } from '../components/Chip.js';
import { MobilePreview } from '../components/MobilePreview.js';
import { QrCode } from '../components/QrCode.js';
import { DYNAMIC_PRESETS, STATIC_DEMOS } from '../demos.js';
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

  const baseUrl = window.location.href.replace(/#.*$/, '');
  const rspeedyDevUrl = useRspeedyDevUrl();
  const lynxUrlSeqRef = useRef(0);

  const currentScenario = useMemo(
    () => ALL_SCENARIOS.find((s) => s.id === scenarioId) ?? ALL_SCENARIOS[0],
    [scenarioId],
  );

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
      const url = buildRenderUrl(
        { protocol, demoUrl: DEFAULT_DEMO_URL, messages: parsed, actionMocks },
        baseUrl,
      );
      setRenderUrl(url);

      // Native in-app preview: pass A2UI payload via global props, directly through URL query.
      // In Lynx, query params are exposed in `lynx.__globalProps` / `useGlobalProps()`.
      const seq = ++lynxUrlSeqRef.current;
      if (rspeedyDevUrl) {
        const uInline = new URL(rspeedyDevUrl);
        uInline.searchParams.set('messages', JSON.stringify(parsed));
        if (actionMocks) {
          uInline.searchParams.set('actionMocks', JSON.stringify(actionMocks));
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
            const r = new URL('render.html', baseUrl);
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
    [baseUrl, protocol, rspeedyDevUrl],
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
    if (currentScenario) {
      const json = formatJson(currentScenario.messages);
      setCustomJson(json);
      doRender(json, currentScenario);
    }
  }, [currentScenario, doRender]);

  const handleClear = useCallback(() => {
    setCustomJson('[]');
    setRenderUrl('');
    setRenderQrError('');
    setError('');
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
          onChange={setCustomJson}
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
      <div className='previewPanel'>
        <div className='previewPanelHeader'>
          <span className='previewPanelTitle'>Lynx Preview</span>
          {currentScenario
            ? (
              <div className='previewPanelMeta'>
                <div className='previewMetaTags'>
                  {currentScenario.tags.map((t) => <Chip key={t}>{t}</Chip>)}
                </div>
              </div>
            )
            : null}
        </div>
        <div className='previewPanelBody'>
          {renderUrl
            ? <MobilePreview src={renderUrl} />
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

        {/* QR Code Section */}
        <div className='previewQrSection'>
          <div className='previewQrContent'>
            <div className='previewQrInfo'>
              <div className='previewQrTitle'>View on Device</div>
            </div>
            {renderUrl
              ? (
                <QrCode
                  value={renderUrl}
                  size={80}
                  onErrorChange={setRenderQrError}
                />
              )
              : (
                <div className='previewQrPlaceholder'>
                  <span className='previewQrPlaceholderText'>No render</span>
                </div>
              )}
          </div>
          {lynxDevUrl
            ? (
              <div className='previewQrContent previewQrContentAlt'>
                <div className='previewQrInfo'>
                  <div className='previewQrTitle'>Lynx Dev Bundle</div>
                  <div className='previewQrDesc'>
                    {lynxDevQrError
                      ? 'QR code unavailable. Open this link with LynxExplorer instead.'
                      : 'Scan with LynxExplorer to load the rspeedy dev bundle.'}
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
      </div>
    </div>
  );
}
