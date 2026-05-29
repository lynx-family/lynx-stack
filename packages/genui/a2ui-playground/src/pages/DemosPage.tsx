// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

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
  messagesUrl?: string;
  actionMocks?: Record<string, unknown>;
  actionMocksUrl?: string;
  demoId?: string;
}

interface PublishedPayload {
  messagesUrl: string;
  actionMocksUrl?: string;
}

type PlayState = 'idle' | 'playing' | 'paused' | 'done';
type PlaybackProgressStatus = 'idle' | 'streaming' | 'paused' | 'done';

const jsonExtensions = [json()];
const ONLINE_A2UI_SERVER_ORIGIN = 'https://genui-server.vercel.app';
const LOCAL_A2UI_SERVER_PORT = '3060';

declare const __A2UI_PLAYGROUND_CLIENT_PAYLOAD_STORE__: boolean;

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? [], null, 2);
}

function formatChunk(msg: unknown): string {
  return JSON.stringify(msg, null, 2);
}

function findScenarioById(id?: string): Scenario | undefined {
  if (!id) return undefined;
  return ALL_SCENARIOS.find((s) => s.id === id);
}

function isDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname.startsWith('10.')
    || hostname.startsWith('192.168.')
    || /^172\.(?:1[6-9]|2\d|3[01])\./u.test(hostname)
  );
}

function getA2UIPayloadEndpoint(): string {
  if (
    window.location.protocol === 'http:' && isDevHost(window.location.hostname)
  ) {
    return `http://${window.location.hostname}:${LOCAL_A2UI_SERVER_PORT}/a2ui/payload`;
  }
  return `${ONLINE_A2UI_SERVER_ORIGIN}/a2ui/payload`;
}

async function publishA2UIPayloadForPreview(
  messages: unknown,
  actionMocks?: Record<string, unknown>,
): Promise<PublishedPayload> {
  const res = await window.fetch(getA2UIPayloadEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, actionMocks }),
  });
  const payload = await res.json().catch(() => ({})) as {
    preview?: {
      messagesUrl?: unknown;
      actionMocksUrl?: unknown;
    };
    error?: unknown;
  };
  if (!res.ok || typeof payload.preview?.messagesUrl !== 'string') {
    throw new Error(
      typeof payload.error === 'string'
        ? payload.error
        : 'Failed to publish A2UI messages',
    );
  }
  return {
    messagesUrl: payload.preview.messagesUrl,
    actionMocksUrl: typeof payload.preview.actionMocksUrl === 'string'
      ? payload.preview.actionMocksUrl
      : undefined,
  };
}

const ALL_SCENARIOS: Scenario[] = [
  ...STATIC_DEMOS.map((d) => ({ ...d, actionMocks: undefined })),
  ...DYNAMIC_PRESETS,
];

const DESKTOP_PREVIEW_MIN_WIDTH = 360;
const DESKTOP_CODE_MIN_WIDTH = 360;
const COMPACT_CODE_MIN_HEIGHT = 220;
const COMPACT_PREVIEW_MIN_HEIGHT = 320;
const RESIZE_BREAKPOINT = 980;

// When idle, playback is a slim header-only strip — JSON editor is the 主角.
// When the user presses Play, playback takes the lion's share of the panel.
const PLAYBACK_PANEL_IDLE_HEIGHT = 48;
const PLAYBACK_PANEL_MIN_HEIGHT_ACTIVE = 200;
const PLAYBACK_PANEL_ACTIVE_RATIO = 0.66;
const PLAYBACK_PANEL_MAX_RATIO = 0.85;

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
  const [isPublishingPayload, setIsPublishingPayload] = useState(false);
  const [previewInput, setPreviewInput] = useState<PreviewInput | null>(() =>
    initialScenario
      ? {
        messages: initialScenario.messages,
        actionMocks: initialScenario.actionMocks,
        demoId: initialScenario.id,
      }
      : null
  );

  // ── Playback state (folded in from the old Playback tab) ────────────────
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [deliveredCount, setDeliveredCount] = useState(0);
  // Height is auto-driven by play state. The user can still drag the splitter
  // mid-session and the override sticks until the next idle ↔ active flip.
  const [playbackPanelHeight, setPlaybackPanelHeight] = useState(
    PLAYBACK_PANEL_IDLE_HEIGHT,
  );
  const [isPlaybackResizing, setIsPlaybackResizing] = useState(false);

  // Messages currently driving playback. Cloned from previewInput at Play time
  // so edits to the JSON editor mid-playback don't desync the visible stream.
  const [playbackMessages, setPlaybackMessages] = useState<unknown[]>([]);

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
    () => findScenarioById(scenarioId) ?? ALL_SCENARIOS[0],
    [scenarioId],
  );

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
    setPlaybackMessages([]);
    lastSentDeliveredRef.current = -1;
  }, [stopStreamTimer]);

  useEffect(() => () => stopStreamTimer(), [stopStreamTimer]);

  // Auto-resize the playback panel based on play state:
  // - idle  → slim header strip (JSON editor is the 主角)
  // - active → dominant, takes most of the vertical space
  useEffect(() => {
    if (isPlaybackActive) {
      const container = codePanelInnerRef.current?.getBoundingClientRect()
        .height;
      const target = container
        ? Math.max(
          PLAYBACK_PANEL_MIN_HEIGHT_ACTIVE,
          Math.round(container * PLAYBACK_PANEL_ACTIVE_RATIO),
        )
        : PLAYBACK_PANEL_MIN_HEIGHT_ACTIVE;
      setPlaybackPanelHeight(target);
    } else {
      setPlaybackPanelHeight(PLAYBACK_PANEL_IDLE_HEIGHT);
    }
  }, [isPlaybackActive]);

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
    // Reset playback inline (without taking the stable resetPlayback in deps)
    // so the chunk stream below the editor stays aligned with the new scenario.
    if (streamTimerRef.current !== null) {
      window.clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setPlayState('idle');
    setDeliveredCount(0);
    setPlaybackMessages([]);
    lastSentDeliveredRef.current = -1;
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
      messagesUrl: previewInput.messagesUrl,
      actionMocks: previewInput.actionMocks,
      actionMocksUrl: previewInput.actionMocksUrl,
      demoId: previewInput.demoId,
      playbackMode: isPlaybackActive,
    };
  }, [previewInput, protocol, theme, isPlaybackActive]);

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

  const commitJson = useCallback((): {
    parsed: unknown;
    isKnownDemo: boolean;
  } | null => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(customJson);
    } catch (e) {
      setError(`Invalid JSON: ${String(e)}`);
      return null;
    }
    setError('');

    const isKnownDemo = !jsonEdited
      && ALL_SCENARIOS.some((s) => s.id === currentScenario?.id);

    setPreviewInput({
      messages: parsed,
      actionMocks: currentScenario?.actionMocks,
      demoId: isKnownDemo ? currentScenario?.id : undefined,
    });
    return { parsed, isKnownDemo };
  }, [currentScenario, customJson, jsonEdited]);

  const handleRender = useCallback(() => {
    const committed = commitJson();
    if (committed) {
      if (!committed.isKnownDemo && !__A2UI_PLAYGROUND_CLIENT_PAYLOAD_STORE__) {
        setIsPublishingPayload(true);
        void publishA2UIPayloadForPreview(
          committed.parsed,
          currentScenario?.actionMocks,
        ).then((preview) => {
          setPreviewInput({
            messages: committed.parsed,
            messagesUrl: preview.messagesUrl,
            actionMocks: currentScenario?.actionMocks,
            actionMocksUrl: preview.actionMocksUrl,
          });
          setPreviewRenderKey((value) => value + 1);
        }).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
        }).finally(() => {
          setIsPublishingPayload(false);
        });
        resetPlayback();
        return;
      }
      resetPlayback();
      setPreviewRenderKey((value) => value + 1);
    }
  }, [commitJson, currentScenario, resetPlayback]);

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
    resetPlayback();
  }, [resetPlayback]);

  const handleBackToExamples = useCallback(() => {
    window.location.hash = `#/${protocol.name}/examples`;
  }, [protocol.name]);

  // ── Playback wiring ─────────────────────────────────────────────────────
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
    const committed = commitJson();
    if (!committed) return;

    const next = Array.isArray(committed.parsed) ? committed.parsed : [];
    if (next.length === 0) {
      setError('Nothing to play: messages list is empty.');
      return;
    }

    stopStreamTimer();
    setPlaybackMessages(next);
    setDeliveredCount(0);
    lastSentDeliveredRef.current = -1;
    setPlayState('playing');
    // Force the preview iframe to remount with `playbackMode=1` so the user
    // sees a fresh stream from chunk 1.
    setPreviewRenderKey((value) => value + 1);
  }, [commitJson, stopStreamTimer]);

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

  // Tick: drive delivered count forward at the chosen speed.
  useEffect(() => {
    if (playState !== 'playing') {
      stopStreamTimer();
      return;
    }
    if (deliveredCount >= playbackMessages.length) {
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
        Math.min(count + 1, playbackMessages.length)
      );
    }, intervalMs);

    return stopStreamTimer;
  }, [
    deliveredCount,
    playState,
    playbackMessages.length,
    playbackSpeed,
    stopStreamTimer,
  ]);

  // Forward progress to the iframe whenever the delivered count changes.
  useEffect(() => {
    if (!isPlaybackActive) return;
    if (lastSentDeliveredRef.current === deliveredCount) return;
    lastSentDeliveredRef.current = deliveredCount;
    const status: PlaybackProgressStatus = isDone
      ? 'done'
      : (isPaused ? 'paused' : 'streaming');
    sendPlaybackProgress(deliveredCount, playbackMessages.length, status);
  }, [
    deliveredCount,
    isDone,
    isPaused,
    isPlaybackActive,
    playbackMessages.length,
    sendPlaybackProgress,
  ]);

  const handleIframeLoad = useCallback(() => {
    // Reset dedupe so the freshly-loaded iframe receives the current count.
    lastSentDeliveredRef.current = -1;
    if (!isPlaybackActive) return;
    const status: PlaybackProgressStatus = isDone
      ? 'done'
      : (isPaused ? 'paused' : 'streaming');
    sendPlaybackProgress(deliveredCount, playbackMessages.length, status);
    if (isPaused) sendPlaybackControl('pause');
  }, [
    deliveredCount,
    isDone,
    isPaused,
    isPlaybackActive,
    playbackMessages.length,
    sendPlaybackControl,
    sendPlaybackProgress,
  ]);

  // ── Vertical resize between editor and playback ─────────────────────────
  const handlePlaybackResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      playbackResizeStopRef.current?.();

      const container = codePanelInnerRef.current;
      const startY = event.clientY;
      const startHeight = playbackPanelHeight;
      // Lower min when idle (slim bar) — the user can drag down to peek at
      // the empty-state copy without entering playback.
      const minHeight = isPlaybackActive
        ? PLAYBACK_PANEL_MIN_HEIGHT_ACTIVE
        : PLAYBACK_PANEL_IDLE_HEIGHT;

      setIsPlaybackResizing(true);
      document.body.dataset.panelResize = 'horizontal';

      const onMove = (moveEvent: PointerEvent) => {
        // Playback sits on top of the editor: dragging the splitter DOWN
        // makes the playback panel taller.
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

  const playbackChunks = playbackMessages.slice(
    0,
    Math.max(0, deliveredCount),
  );
  const playbackTotal = playbackMessages.length;
  const playbackProgressRatio = playbackTotal === 0
    ? 0
    : Math.min(deliveredCount, playbackTotal) / playbackTotal;

  const playbackPrimaryButton = isPlaying
    ? (
      <button
        type='button'
        className='toolbarBtn'
        onClick={handlePause}
        title='Pause playback'
      >
        ⏸ Pause
      </button>
    )
    : (isPaused
      ? (
        <button
          type='button'
          className='toolbarBtn primary'
          onClick={handleResume}
          title='Resume playback'
        >
          ▶ Resume
        </button>
      )
      : (
        <button
          type='button'
          className='toolbarBtn primary'
          onClick={handlePlay}
          title='Start playback'
        >
          ▶ Play
        </button>
      ));

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
              <span className='playbackSectionBadge'>LLM stream</span>
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
                    Press ▶ to replay this LLM payload chunk by chunk
                  </span>
                )}
              <div className='spacer' />
              <div className='playbackHeaderControls'>
                {isPlaybackActive
                  ? (
                    <button
                      type='button'
                      className='toolbarBtn'
                      onClick={handleRestart}
                      title='Restart playback'
                    >
                      ↻
                    </button>
                  )
                  : null}
                {playbackPrimaryButton}
              </div>
            </header>

            {isPlaybackActive
              ? (
                <>
                  <div
                    className={isPlaybackActive
                      ? 'playbackProgressTrack active'
                      : 'playbackProgressTrack'}
                  >
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
                        ? ' — complete'
                        : (isPaused
                          ? ' — paused'
                          : ' — streaming…')}
                    </span>
                  </div>

                  <div className='playbackStream'>
                    {playbackChunks.length > 0
                      ? playbackChunks.map((msg, i) => {
                        const isLatest = i === deliveredCount - 1;
                        return (
                          <div
                            key={i}
                            className={isLatest && isPlaying
                              ? 'playbackChunk live'
                              : 'playbackChunk'}
                          >
                            <div className='playbackChunkHeader'>
                              <span className='playbackChunkIndex'>
                                #{i + 1}
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
                              {formatChunk(msg)}
                            </pre>
                          </div>
                        );
                      })
                      : (
                        <div className='playbackEmpty subtle'>
                          Streaming…
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
            aria-label='Resize Playback and Messages panels'
            title='Drag to resize'
            onPointerDown={handlePlaybackResizeStart}
          >
            <span className='playbackSplitterGrip' aria-hidden='true' />
          </div>

          <div className='codePanelEditorSection'>
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
                  disabled={isPublishingPayload}
                >
                  {isPublishingPayload ? 'Publishing...' : '▶ Render'}
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
        </div>
      </div>

      <PanelResizeHandle
        isActive={isPanelResizing}
        isCompactLayout={isCompactLayout}
        ariaLabel='Resize JSON and preview panels'
        onPointerDown={handlePanelResizeStart}
      />

      <div className='examplesPreviewWrap' style={previewPanelStyle}>
        <PreviewPanel
          className='previewPanel examplesPreviewPanel'
          title='Lynx Preview'
          showPreviewModeSwitch
          // Speed lives inside PreviewPanel's existing "Simulated" bar,
          // but state is owned here so it also drives the parent's
          // `A2UI_PLAYBACK_PROGRESS` tick interval during playback.
          // Single source of truth, single visible knob, single code path.
          speed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
          previewSource={previewSource}
        >
          <PreviewViewport
            key={previewRenderKey}
            iframeRef={iframeRef}
            onLoad={handleIframeLoad}
            retainPreviousFrame
            emptyTitle='Select a demo to preview'
            emptySubTitle='Lynx rendering will appear here'
          />
        </PreviewPanel>
      </div>
    </div>
  );
}
