// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

import './DemosPage.css';

import { Button } from '../components/Button.js';
import { ChevronLeft, Pause, Play, RotateCcw, X } from '../components/Icon.js';
import { MobileTabBar } from '../components/MobileTabBar.js';
import type { MobilePaneTab } from '../components/MobileTabBar.js';
import { PanelResizeHandle } from '../components/PanelResizeHandle.js';
import { PreviewPanel } from '../components/PreviewPanel.js';
import { PreviewViewport } from '../components/PreviewViewport.js';
import { useResizablePanels } from '../hooks/useResizablePanels.js';
import {
  OPENUI_SCENARIOS,
  parseOpenUIScenarioRaw,
} from '../mock/openui-scenarios.js';
import type { OpenUIScenario } from '../mock/openui-scenarios.js';
import type { Protocol } from '../utils/protocol.js';

interface PreviewInput {
  rawText: string;
}

type PlayState = 'idle' | 'playing' | 'paused' | 'done';
type PlaybackProgressStatus = 'idle' | 'streaming' | 'paused' | 'done';
type CodeView = 'raw' | 'parsed';

const DESKTOP_PREVIEW_MIN_WIDTH = 360;
const DESKTOP_CODE_MIN_WIDTH = 360;
const COMPACT_CODE_MIN_HEIGHT = 220;
const COMPACT_PREVIEW_MIN_HEIGHT = 320;
const RESIZE_BREAKPOINT = 980;

const PLAYBACK_PANEL_IDLE_HEIGHT = 48;
const PLAYBACK_PANEL_MIN_HEIGHT_ACTIVE = 200;
const PLAYBACK_PANEL_ACTIVE_RATIO = 0.66;
const PLAYBACK_PANEL_MAX_RATIO = 0.85;
const OPENUI_PLAYBACK_CHUNK_SIZE = 240;

function findScenarioById(id?: string): OpenUIScenario | undefined {
  if (!id) return undefined;
  return OPENUI_SCENARIOS.find((scenario) => scenario.id === id);
}

function chunkOpenUI(rawText: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < rawText.length; i += OPENUI_PLAYBACK_CHUNK_SIZE) {
    chunks.push(rawText.slice(i, i + OPENUI_PLAYBACK_CHUNK_SIZE));
  }
  return chunks;
}

function formatChunk(chunk: string): string {
  return chunk;
}

export function OpenUIDemosPage(props: {
  protocol: Protocol;
  demoId?: string;
}) {
  const { protocol, demoId } = props;
  const initialScenario = findScenarioById(demoId) ?? OPENUI_SCENARIOS[0];

  const [scenarioId, setScenarioId] = useState<string>(
    initialScenario?.id ?? '',
  );
  const [customRawText, setCustomRawText] = useState<string>(
    initialScenario?.raw ?? '',
  );
  const [error, setError] = useState('');
  const [previewRenderKey, setPreviewRenderKey] = useState(0);
  const [activeMobileTab, setActiveMobileTab] = useState<MobilePaneTab>('edit');
  const [codeView, setCodeView] = useState<CodeView>('raw');
  const [previewInput, setPreviewInput] = useState<PreviewInput | null>(() =>
    initialScenario ? { rawText: initialScenario.raw } : null
  );

  const [playState, setPlayState] = useState<PlayState>('idle');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [playbackPanelHeight, setPlaybackPanelHeight] = useState(
    PLAYBACK_PANEL_IDLE_HEIGHT,
  );
  const [isPlaybackResizing, setIsPlaybackResizing] = useState(false);
  const [playbackChunksSource, setPlaybackChunksSource] = useState<string[]>(
    [],
  );

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  const lastSentDeliveredRef = useRef(-1);
  const codePanelInnerRef = useRef<HTMLDivElement | null>(null);
  const playbackResizeStopRef = useRef<(() => void) | null>(null);

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
    initialSecondarySize: 480,
  });

  const currentScenario = useMemo(
    () => findScenarioById(scenarioId) ?? OPENUI_SCENARIOS[0],
    [scenarioId],
  );

  const parsedJson = useMemo(() => {
    if (!customRawText.trim()) return '';
    if (currentScenario && customRawText === currentScenario.raw) {
      return currentScenario.parsed;
    }

    try {
      return parseOpenUIScenarioRaw(customRawText);
    } catch (err) {
      return `Unable to parse OpenUI DSL:\n${String(err)}`;
    }
  }, [currentScenario, customRawText]);

  const isPlaybackActive = playState !== 'idle';
  const isPlaying = playState === 'playing';
  const isPaused = playState === 'paused';
  const isDone = playState === 'done';

  const stopStreamTimer = useCallback(() => {
    if (streamTimerRef.current !== null) {
      window.clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }, []);

  const resetPlayback = useCallback(() => {
    stopStreamTimer();
    setPlayState('idle');
    setDeliveredCount(0);
    setPlaybackChunksSource([]);
    lastSentDeliveredRef.current = -1;
  }, [stopStreamTimer]);

  useEffect(() => () => stopStreamTimer(), [stopStreamTimer]);

  useEffect(() => {
    if (isPlaybackActive) {
      const containerHeight = codePanelInnerRef.current?.getBoundingClientRect()
        .height;
      const target = containerHeight
        ? Math.max(
          PLAYBACK_PANEL_MIN_HEIGHT_ACTIVE,
          Math.round(containerHeight * PLAYBACK_PANEL_ACTIVE_RATIO),
        )
        : PLAYBACK_PANEL_MIN_HEIGHT_ACTIVE;
      setPlaybackPanelHeight(target);
      return;
    }

    setPlaybackPanelHeight(PLAYBACK_PANEL_IDLE_HEIGHT);
  }, [isPlaybackActive]);

  useEffect(() => {
    const nextScenario = findScenarioById(demoId) ?? OPENUI_SCENARIOS[0];
    if (!nextScenario) return;
    setScenarioId(nextScenario.id);
    setCustomRawText(nextScenario.raw);
    setError('');
    setPreviewInput({ rawText: nextScenario.raw });
    if (streamTimerRef.current !== null) {
      window.clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setPlayState('idle');
    setDeliveredCount(0);
    setPlaybackChunksSource([]);
    lastSentDeliveredRef.current = -1;
  }, [demoId]);

  const previewSource = useMemo(() => {
    if (!previewInput) return undefined;
    return {
      kind: 'openui' as const,
      rawText: previewInput.rawText,
      playbackMode: isPlaybackActive,
    };
  }, [isPlaybackActive, previewInput]);

  const handleSelectScenario = useCallback(
    (id: string) => {
      window.location.hash = `#/${protocol.name}/examples/${id}`;
      setScenarioId(id);
      setError('');
      const scenario = findScenarioById(id);
      if (scenario) {
        setCustomRawText(scenario.raw);
        setPreviewInput({ rawText: scenario.raw });
      }
      resetPlayback();
    },
    [protocol.name, resetPlayback],
  );

  const handleBackToExamples = useCallback(() => {
    window.location.hash = `#/${protocol.name}/examples`;
  }, [protocol.name]);

  const commitRawText = useCallback((): string | null => {
    if (!customRawText.trim()) {
      setError('Raw output is empty.');
      return null;
    }

    setError('');
    setPreviewInput({ rawText: customRawText });
    return customRawText;
  }, [customRawText]);

  const handleRender = useCallback(() => {
    const committed = commitRawText();
    if (!committed) return;
    resetPlayback();
    setPreviewRenderKey((value) => value + 1);
  }, [commitRawText, resetPlayback]);

  const handleFillExample = useCallback(() => {
    setError('');
    if (currentScenario) {
      setCustomRawText(currentScenario.raw);
      setPreviewInput({ rawText: currentScenario.raw });
    }
    resetPlayback();
  }, [currentScenario, resetPlayback]);

  const handleClear = useCallback(() => {
    setCustomRawText('');
    setPreviewInput(null);
    setError('');
    resetPlayback();
  }, [resetPlayback]);

  const sendPlaybackProgress = useCallback((
    delivered: number,
    total: number,
    status: PlaybackProgressStatus,
  ) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: 'A2UI_PLAYBACK_PROGRESS',
        data: {
          deliveredCount: delivered,
          totalCount: total,
          status,
        },
      },
      '*',
    );
  }, []);

  const sendPlaybackControl = useCallback((action: 'pause' | 'resume') => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: 'A2UI_PLAYBACK_CONTROL', action }, '*');
  }, []);

  const handlePlay = useCallback(() => {
    const committed = commitRawText();
    if (!committed) return;

    const nextChunks = chunkOpenUI(committed);
    if (nextChunks.length === 0) {
      setError('Nothing to play: raw output is empty.');
      return;
    }

    stopStreamTimer();
    setPlaybackChunksSource(nextChunks);
    setDeliveredCount(0);
    lastSentDeliveredRef.current = -1;
    setPlayState('playing');
    setPreviewRenderKey((value) => value + 1);
  }, [commitRawText, stopStreamTimer]);

  const handlePause = useCallback(() => {
    if (!isPlaying) return;
    stopStreamTimer();
    setPlayState('paused');
    sendPlaybackControl('pause');
  }, [isPlaying, sendPlaybackControl, stopStreamTimer]);

  const handleResume = useCallback(() => {
    if (!isPaused) return;
    setPlayState('playing');
    sendPlaybackControl('resume');
  }, [isPaused, sendPlaybackControl]);

  const handleRestart = useCallback(() => {
    handlePlay();
  }, [handlePlay]);

  useEffect(() => {
    if (playState !== 'playing') {
      stopStreamTimer();
      return;
    }
    if (deliveredCount >= playbackChunksSource.length) {
      stopStreamTimer();
      setPlayState('done');
      return;
    }

    const intervalMs = Math.max(
      120,
      Math.round(800 / Math.max(playbackSpeed, 0.25)),
    );
    streamTimerRef.current = window.setTimeout(() => {
      setDeliveredCount((count) =>
        Math.min(count + 1, playbackChunksSource.length)
      );
    }, intervalMs);

    return stopStreamTimer;
  }, [
    deliveredCount,
    playState,
    playbackChunksSource.length,
    playbackSpeed,
    stopStreamTimer,
  ]);

  useEffect(() => {
    if (!isPlaybackActive) return;
    if (lastSentDeliveredRef.current === deliveredCount) return;
    lastSentDeliveredRef.current = deliveredCount;
    const status: PlaybackProgressStatus = isDone
      ? 'done'
      : (isPaused ? 'paused' : 'streaming');
    sendPlaybackProgress(deliveredCount, playbackChunksSource.length, status);
  }, [
    deliveredCount,
    isDone,
    isPaused,
    isPlaybackActive,
    playbackChunksSource.length,
    sendPlaybackProgress,
  ]);

  const handleIframeLoad = useCallback(() => {
    lastSentDeliveredRef.current = -1;
    if (!isPlaybackActive) return;
    const status: PlaybackProgressStatus = isDone
      ? 'done'
      : (isPaused ? 'paused' : 'streaming');
    sendPlaybackProgress(deliveredCount, playbackChunksSource.length, status);
    if (isPaused) sendPlaybackControl('pause');
  }, [
    deliveredCount,
    isDone,
    isPaused,
    isPlaybackActive,
    playbackChunksSource.length,
    sendPlaybackControl,
    sendPlaybackProgress,
  ]);

  const handlePlaybackResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      playbackResizeStopRef.current?.();

      const container = codePanelInnerRef.current;
      const startY = event.clientY;
      const startHeight = playbackPanelHeight;
      const minHeight = isPlaybackActive
        ? PLAYBACK_PANEL_MIN_HEIGHT_ACTIVE
        : PLAYBACK_PANEL_IDLE_HEIGHT;

      setIsPlaybackResizing(true);
      document.body.dataset.panelResize = 'horizontal';

      const onMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientY - startY;
        let next = startHeight + delta;
        const containerHeight = container?.getBoundingClientRect().height
          ?? Number.POSITIVE_INFINITY;
        const max = Math.max(
          minHeight,
          containerHeight * PLAYBACK_PANEL_MAX_RATIO,
        );
        if (next < minHeight) next = minHeight;
        if (next > max) next = max;
        setPlaybackPanelHeight(next);
      };

      const stop = () => {
        setIsPlaybackResizing(false);
        delete document.body.dataset.panelResize;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
        playbackResizeStopRef.current = null;
      };

      playbackResizeStopRef.current = stop;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
    },
    [isPlaybackActive, playbackPanelHeight],
  );

  useEffect(() => () => playbackResizeStopRef.current?.(), []);

  const playbackPanelStyle = useMemo<CSSProperties>(() => {
    return { height: `${playbackPanelHeight}px` };
  }, [playbackPanelHeight]);

  const playbackChunks = playbackChunksSource.slice(
    0,
    Math.max(0, deliveredCount),
  );
  const playbackTotal = playbackChunksSource.length;
  const playbackProgressRatio = playbackTotal === 0
    ? 0
    : Math.min(deliveredCount, playbackTotal) / playbackTotal;

  const playbackPrimaryButton = isPlaying
    ? (
      <Button
        variant='primary'
        size='sm'
        iconBefore={Pause}
        onClick={handlePause}
        title='Pause playback'
      >
        Pause
      </Button>
    )
    : (isPaused
      ? (
        <Button
          variant='primary'
          size='sm'
          iconBefore={Play}
          onClick={handleResume}
          title='Resume playback'
        >
          Resume
        </Button>
      )
      : (
        <Button
          variant='primary'
          size='sm'
          iconBefore={Play}
          onClick={handlePlay}
          title='Start playback'
        >
          Play
        </Button>
      ));

  return (
    <div
      ref={pageRef}
      className={isPanelResizing ? 'demosPage resizing' : 'demosPage'}
      data-active-tab={activeMobileTab}
    >
      <aside className='sidebar'>
        <div className='sidebarTopNav'>
          <Button
            variant='secondary'
            size='md'
            responsiveIconOnly
            iconBefore={ChevronLeft}
            onClick={handleBackToExamples}
            aria-label='Back to Examples'
          >
            Back to Examples
          </Button>
        </div>
        <div className='sidebarSection'>
          <div className='sidebarHeading'>Scenarios</div>
          <div className='scenarioList'>
            {OPENUI_SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type='button'
                className={[
                  'scenarioItem',
                  scenario.id === scenarioId ? 'active' : '',
                  scenario.badge ? 'hasBadge' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleSelectScenario(scenario.id)}
              >
                <span className='scenarioName'>{scenario.title}</span>
                {scenario.badge
                  ? <span className='scenarioBadge'>{scenario.badge}</span>
                  : null}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div
        className={isPlaybackResizing ? 'codePanel resizing' : 'codePanel'}
        style={codePanelStyle}
      >
        <div className='codePanelInner' ref={codePanelInnerRef}>
          <section
            className={isPlaybackActive
              ? 'playbackSection top active'
              : 'playbackSection top idle'}
            style={playbackPanelStyle}
            aria-label='Playback'
          >
            <header className='playbackSectionHeader'>
              <span className='playbackSectionTitle'>Playback</span>
              <span className='sectionBadge'>LLM stream</span>
              {isPlaybackActive
                ? (
                  <span
                    className={isDone
                      ? 'playbackStateDot done'
                      : (isPaused
                        ? 'playbackStateDot paused'
                        : 'playbackStateDot live')}
                    aria-hidden='true'
                  />
                )
                : (
                  <span className='playbackIdleHint'>
                    <Play size={11} strokeWidth={2.25} aria-hidden='true' />
                    Replay payload chunk by chunk
                  </span>
                )}
              <div className='spacer' />
              <div className='playbackHeaderControls'>
                {isPlaybackActive
                  ? (
                    <Button
                      variant='ghost'
                      size='sm'
                      iconOnly
                      iconBefore={RotateCcw}
                      onClick={handleRestart}
                      title='Restart playback'
                      aria-label='Restart playback'
                    />
                  )
                  : null}
                {playbackPrimaryButton}
              </div>
            </header>

            {isPlaybackActive
              ? (
                <>
                  <div className='playbackProgressTrack active'>
                    <div
                      className='playbackProgressFill'
                      style={{
                        width: `${Math.round(playbackProgressRatio * 100)}%`,
                      }}
                    />
                    <span className='playbackProgressLabel'>
                      {Math.min(deliveredCount, playbackTotal)}
                      {' / '}
                      {playbackTotal} chunks
                      {isDone
                        ? ' - complete'
                        : (isPaused
                          ? ' - paused'
                          : ' - streaming...')}
                    </span>
                  </div>

                  <div className='playbackStream'>
                    {playbackChunks.length > 0
                      ? playbackChunks.map((chunk, index) => {
                        const isLatest = index === deliveredCount - 1;
                        return (
                          <div
                            key={index}
                            className={isLatest && isPlaying
                              ? 'playbackChunk live'
                              : 'playbackChunk'}
                          >
                            <div className='playbackChunkHeader'>
                              <span className='playbackChunkIndex'>
                                #{index + 1}
                              </span>
                              {isLatest && isPlaying
                                ? (
                                  <span className='playbackChunkLiveTag'>
                                    live
                                  </span>
                                )
                                : null}
                            </div>
                            <pre className='playbackChunkJson'>
                              {formatChunk(chunk)}
                            </pre>
                          </div>
                        );
                      })
                      : (
                        <div className='playbackEmpty subtle'>
                          Streaming...
                        </div>
                      )}
                  </div>
                </>
              )
              : null}
          </section>

          <div
            className={isPlaybackResizing
              ? 'playbackSplitter active'
              : 'playbackSplitter'}
            role='separator'
            aria-orientation='horizontal'
            aria-label='Resize Playback and OpenUI output panels'
            title='Drag to resize'
            onPointerDown={handlePlaybackResizeStart}
          >
            <span className='playbackSplitterGrip' aria-hidden='true' />
          </div>

          <div className='codePanelEditorSection'>
            <div className='codePanelToolbar openuiCodeToolbar'>
              <div className='codePanelTitle openuiCodeTitle'>
                <span className='openuiCodeTitleText'>OpenUI Output</span>
              </div>
              <div className='previewModeSwitch openuiCodeViewSwitch'>
                <button
                  type='button'
                  className={codeView === 'raw'
                    ? 'previewModeBtn active'
                    : 'previewModeBtn'}
                  onClick={() => setCodeView('raw')}
                  title='Raw Output'
                >
                  Raw
                </button>
                <button
                  type='button'
                  className={codeView === 'parsed'
                    ? 'previewModeBtn active'
                    : 'previewModeBtn'}
                  onClick={() => setCodeView('parsed')}
                  title='Parsed JSON'
                >
                  JSON
                </button>
              </div>
              <div className='spacer' />
              <div className='toolbarActions openuiToolbarActions'>
                <Button
                  variant='ghost'
                  size='sm'
                  iconOnly
                  iconBefore={RotateCcw}
                  onClick={handleFillExample}
                  title='Reset to example'
                  aria-label='Reset to example'
                />
                <Button
                  variant='ghost'
                  size='sm'
                  iconOnly
                  iconBefore={X}
                  onClick={handleClear}
                  title='Clear editor'
                  aria-label='Clear editor'
                />
                <Button
                  variant='primary'
                  size='sm'
                  iconBefore={Play}
                  onClick={handleRender}
                >
                  Render
                </Button>
              </div>
            </div>
            <CodeMirror
              key={codeView}
              className='codeEditor'
              value={codeView === 'raw' ? customRawText : parsedJson}
              onChange={codeView === 'raw' ? setCustomRawText : undefined}
              editable={codeView === 'raw'}
              theme='dark'
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
              }}
            />
            {error ? <div className='codeError'>{error}</div> : null}
          </div>
        </div>
      </div>

      <PanelResizeHandle
        isActive={isPanelResizing}
        isCompactLayout={isCompactLayout}
        ariaLabel='Resize OpenUI output and preview panels'
        onPointerDown={handlePanelResizeStart}
      />

      <div className='examplesPreviewWrap' style={previewPanelStyle}>
        <PreviewPanel
          className='previewPanel examplesPreviewPanel'
          title='Lynx Preview'
          showPreviewModeSwitch
          speed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
          previewSource={previewSource}
        >
          <PreviewViewport
            key={previewRenderKey}
            iframeRef={iframeRef}
            onLoad={handleIframeLoad}
            retainPreviousFrame
            emptyTitle='Select a scenario to preview'
            emptySubTitle='Lynx rendering will appear here'
          />
        </PreviewPanel>
      </div>

      <MobileTabBar
        activeTab={activeMobileTab}
        onChange={setActiveMobileTab}
        editLabel='Code'
      />
    </div>
  );
}
