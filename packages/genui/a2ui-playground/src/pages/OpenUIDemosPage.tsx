// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useMemo, useState } from 'react';

import './DemosPage.css';

import { PanelResizeHandle } from '../components/PanelResizeHandle.js';
import { PreviewPanel } from '../components/PreviewPanel.js';
import { PreviewViewport } from '../components/PreviewViewport.js';
import { useResizablePanels } from '../hooks/useResizablePanels.js';
import { OPENUI_SCENARIOS } from '../mock/openui-scenarios.js';
import type { Protocol } from '../utils/protocol.js';

type CodeView = 'raw' | 'parsed';

const DESKTOP_PREVIEW_MIN_WIDTH = 320;
const DESKTOP_CODE_MIN_WIDTH = 360;
const COMPACT_CODE_MIN_HEIGHT = 220;
const COMPACT_PREVIEW_MIN_HEIGHT = 320;
const RESIZE_BREAKPOINT = 980;

interface PreviewInput {
  rawText: string;
}

export function OpenUIDemosPage(_props: { protocol: Protocol }) {
  const [codeView, setCodeView] = useState<CodeView>('raw');
  const [scenarioId, setScenarioId] = useState<string>(
    OPENUI_SCENARIOS[0]?.id ?? '',
  );
  const [customRawText, setCustomRawText] = useState('');
  const [error, setError] = useState('');
  const [previewRenderKey, setPreviewRenderKey] = useState(0);
  const [previewInput, setPreviewInput] = useState<PreviewInput | null>(() => {
    const initialScenario = OPENUI_SCENARIOS[0];
    return initialScenario ? { rawText: initialScenario.raw } : null;
  });

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
    initialPrimarySize: 320,
    initialSecondarySize: 420,
  });

  const currentScenario = useMemo(
    () =>
      OPENUI_SCENARIOS.find((s) => s.id === scenarioId)
        ?? OPENUI_SCENARIOS[0],
    [scenarioId],
  );

  useEffect(() => {
    if (currentScenario) {
      setCustomRawText(currentScenario.raw);
      setPreviewInput({ rawText: currentScenario.raw });
    }
  }, [currentScenario]);

  const previewSource = useMemo(() => {
    if (!previewInput) return undefined;
    return {
      kind: 'openui' as const,
      rawText: previewInput.rawText,
    };
  }, [previewInput]);

  const handleSelectScenario = useCallback((id: string) => {
    setScenarioId(id);
  }, []);

  const handleRender = useCallback(() => {
    if (!customRawText.trim()) {
      setError('Raw output is empty.');
      return;
    }
    setError('');
    setPreviewInput({ rawText: customRawText });
    setPreviewRenderKey((value) => value + 1);
  }, [customRawText]);

  return (
    <div
      ref={pageRef}
      className={isPanelResizing ? 'demosPage resizing' : 'demosPage'}
    >
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
        {error ? <div className='codeError'>{error}</div> : null}
      </div>

      <PanelResizeHandle
        isActive={isPanelResizing}
        isCompactLayout={isCompactLayout}
        ariaLabel='Resize examples and preview panels'
        onPointerDown={handlePanelResizeStart}
      />

      <PreviewPanel
        className='previewPanel'
        style={previewPanelStyle}
        title='Lynx Preview'
        showPreviewModeSwitch
        previewSource={previewSource}
      >
        <PreviewViewport
          key={previewRenderKey}
          emptyTitle='Select a scenario to preview'
          emptySubTitle='Lynx rendering will appear here'
        />
      </PreviewPanel>
    </div>
  );
}
