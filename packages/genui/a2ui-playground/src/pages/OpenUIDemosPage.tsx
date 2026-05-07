// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useState } from 'react';

import { OPENUI_SCENARIOS } from '../mock/openui-scenarios.js';
import type { Protocol } from '../utils/protocol.js';

type CodeView = 'raw' | 'parsed';

export function OpenUIDemosPage(_props: { protocol: Protocol }) {
  const [codeView, setCodeView] = useState<CodeView>('raw');
  const [scenarioId, setScenarioId] = useState<string>(
    OPENUI_SCENARIOS[0]?.id ?? '',
  );

  const currentScenario = OPENUI_SCENARIOS.find((s) => s.id === scenarioId)
    ?? OPENUI_SCENARIOS[0];

  const handleSelectScenario = useCallback((id: string) => {
    setScenarioId(id);
  }, []);

  return (
    <div className='demosPage'>
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
      <div className='codePanel'>
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

      {/* Preview Panel: Lynx Preview */}
      <div className='previewPanel'>
        <div className='previewPanelHeader'>
          <span className='previewPanelTitle'>Lynx Preview</span>
        </div>
        <div className='previewPanelBody'>
          <div className='previewEmpty'>
            <div className='previewEmptyIcon'>▶</div>
            <div>Select a scenario to preview</div>
            <div className='previewEmptySub'>
              Lynx rendering will appear here
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
