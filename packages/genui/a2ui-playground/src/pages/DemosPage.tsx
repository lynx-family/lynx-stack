// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useEffect, useMemo, useState } from 'react';

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

  const baseUrl = window.location.href.replace(/#.*$/, '');

  const currentScenario = useMemo(
    () => ALL_SCENARIOS.find((s) => s.id === scenarioId) ?? ALL_SCENARIOS[0],
    [scenarioId],
  );

  const doRender = useCallback(
    (json: string, scenario: Scenario | undefined) => {
      setError('');
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
    },
    [baseUrl, protocol],
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
              <div className='previewQrDesc'>
                Scan the QR code to preview this A2UI rendering natively on your
                mobile device.
              </div>
            </div>
            {renderUrl
              ? <QrCode value={renderUrl} size={80} />
              : (
                <div className='previewQrPlaceholder'>
                  <span className='previewQrPlaceholderText'>No render</span>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
