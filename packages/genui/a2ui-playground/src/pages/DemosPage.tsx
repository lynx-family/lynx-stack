// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useEffect, useMemo, useState } from 'react';

import './DemosPage.css';

import { PanelResizeHandle } from '../components/PanelResizeHandle.js';
import { PreviewPanel } from '../components/PreviewPanel.js';
import { PreviewViewport } from '../components/PreviewViewport.js';
import { DYNAMIC_PRESETS, STATIC_DEMOS } from '../demos.js';
import { useResizablePanels } from '../hooks/useResizablePanels.js';
import { DEFAULT_A2UI_DEMO_URL } from '../utils/demoUrl.js';
import type { Protocol } from '../utils/protocol.js';

interface Scenario {
  id: string;
  title: string;
  tags: string[];
  messages: unknown;
  actionMocks?: Record<string, unknown>;
}

interface PreviewInput {
  messages: unknown;
  actionMocks?: Record<string, unknown>;
  demoId?: string;
}

const jsonExtensions = [json()];

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? [], null, 2);
}

function findScenarioById(id?: string): Scenario | undefined {
  if (!id) return undefined;
  return ALL_SCENARIOS.find((s) => s.id === id);
}

const ALL_SCENARIOS: Scenario[] = [
  ...STATIC_DEMOS.map((d) => ({ ...d, actionMocks: undefined })),
  ...DYNAMIC_PRESETS,
];

const DESKTOP_PREVIEW_MIN_WIDTH = 420;
const DESKTOP_CODE_MIN_WIDTH = 360;
const COMPACT_CODE_MIN_HEIGHT = 220;
const COMPACT_PREVIEW_MIN_HEIGHT = 320;
const RESIZE_BREAKPOINT = 980;

export function DemosPage(props: {
  protocol: Protocol;
  demoId?: string;
  theme: 'light' | 'dark';
}) {
  const { protocol, demoId, theme } = props;
  const initialScenario = findScenarioById(demoId) ?? ALL_SCENARIOS[0];

  const [scenarioId, setScenarioId] = useState<string>(
    initialScenario?.id ?? '',
  );
  const [customJson, setCustomJson] = useState<string>(() =>
    formatJson(initialScenario?.messages)
  );
  const [error, setError] = useState('');
  const [jsonEdited, setJsonEdited] = useState(false);
  const [previewRenderKey, setPreviewRenderKey] = useState(0);
  const [previewInput, setPreviewInput] = useState<PreviewInput | null>(() =>
    initialScenario
      ? {
        messages: initialScenario.messages,
        actionMocks: initialScenario.actionMocks,
        demoId: initialScenario.id,
      }
      : null
  );

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
    initialPrimarySize: 360,
    initialSecondarySize: 760,
  });

  const currentScenario = useMemo(
    () => findScenarioById(scenarioId) ?? ALL_SCENARIOS[0],
    [scenarioId],
  );

  useEffect(() => {
    const nextScenario = findScenarioById(demoId) ?? ALL_SCENARIOS[0];
    if (!nextScenario) return;
    setScenarioId(nextScenario.id);
    setCustomJson(formatJson(nextScenario.messages));
    setError('');
    setJsonEdited(false);
    setPreviewInput({
      messages: nextScenario.messages,
      actionMocks: nextScenario.actionMocks,
      demoId: nextScenario.id,
    });
  }, [demoId]);

  useEffect(() => {
    if (!currentScenario) return;
    setPreviewInput({
      messages: currentScenario.messages,
      actionMocks: currentScenario.actionMocks,
      demoId: currentScenario.id,
    });
  }, [currentScenario]);

  const previewSource = useMemo(() => {
    if (!previewInput) return undefined;
    return {
      kind: 'a2ui' as const,
      protocol,
      theme,
      demoUrl: DEFAULT_A2UI_DEMO_URL,
      messages: previewInput.messages,
      actionMocks: previewInput.actionMocks,
      demoId: previewInput.demoId,
    };
  }, [previewInput, protocol, theme]);

  const handleSelectScenario = useCallback(
    (id: string) => {
      window.location.hash = `#/${protocol.name}/examples/${id}`;
      setScenarioId(id);
      setError('');
      setJsonEdited(false);
      const scenario = findScenarioById(id);
      if (scenario) {
        setCustomJson(formatJson(scenario.messages));
        setPreviewInput({
          messages: scenario.messages,
          actionMocks: scenario.actionMocks,
          demoId: scenario.id,
        });
      }
    },
    [protocol.name],
  );

  const handleRender = useCallback(() => {
    setError('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(customJson);
    } catch (e) {
      setError(`Invalid JSON: ${String(e)}`);
      return;
    }

    const isKnownDemo = !jsonEdited
      && ALL_SCENARIOS.some((s) => s.id === currentScenario?.id);

    setPreviewInput({
      messages: parsed,
      actionMocks: currentScenario?.actionMocks,
      demoId: isKnownDemo ? currentScenario?.id : undefined,
    });
    setPreviewRenderKey((value) => value + 1);
  }, [currentScenario, customJson, jsonEdited]);

  const handleFillExample = useCallback(() => {
    setError('');
    setJsonEdited(false);
    if (currentScenario) {
      const json = formatJson(currentScenario.messages);
      setCustomJson(json);
      setPreviewInput({
        messages: currentScenario.messages,
        actionMocks: currentScenario.actionMocks,
        demoId: currentScenario.id,
      });
    }
  }, [currentScenario]);

  const handleClear = useCallback(() => {
    setCustomJson('[]');
    setPreviewInput(null);
    setError('');
    setJsonEdited(false);
  }, []);

  const handleBackToExamples = useCallback(() => {
    window.location.hash = `#/${protocol.name}/examples`;
  }, [protocol.name]);

  return (
    <div
      ref={pageRef}
      className={isPanelResizing ? 'demosPage resizing' : 'demosPage'}
    >
      <aside className='sidebar'>
        <div className='sidebarTopNav'>
          <button
            type='button'
            className='detailBackButton'
            onClick={handleBackToExamples}
            aria-label='Back to Examples'
          >
            <span className='detailBackIcon'>←</span>
            <span className='detailBackLabel'>Back to Examples</span>
          </button>
        </div>
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

      <div className='codePanel' style={codePanelStyle}>
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

      <PanelResizeHandle
        isActive={isPanelResizing}
        isCompactLayout={isCompactLayout}
        ariaLabel='Resize JSON and preview panels'
        onPointerDown={handlePanelResizeStart}
      />

      <PreviewPanel
        className='previewPanel examplesPreviewPanel'
        style={previewPanelStyle}
        title='Lynx Preview'
        showPreviewModeSwitch
        previewSource={previewSource}
      >
        <PreviewViewport
          key={previewRenderKey}
          emptyTitle='Select a demo to preview'
          emptySubTitle='Lynx rendering will appear here'
        />
      </PreviewPanel>
    </div>
  );
}
