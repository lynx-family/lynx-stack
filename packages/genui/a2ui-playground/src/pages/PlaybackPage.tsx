// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './PlaybackPage.css';

import { PanelResizeHandle } from '../components/PanelResizeHandle.js';
import { PreviewViewport } from '../components/PreviewViewport.js';
import { DYNAMIC_PRESETS, STATIC_DEMOS } from '../demos.js';
import { useResizablePanels } from '../hooks/useResizablePanels.js';
import { DEFAULT_A2UI_DEMO_URL } from '../utils/demoUrl.js';
import type { Protocol } from '../utils/protocol.js';

type Theme = 'light' | 'dark';
type PlayState = 'idle' | 'playing' | 'paused' | 'done';
type PlaybackControlAction = 'pause' | 'resume';
type PlaybackProgressStatus = 'idle' | 'streaming' | 'paused' | 'done';

const DESKTOP_STREAM_MIN_WIDTH = 360;
const DESKTOP_PREVIEW_MIN_WIDTH = 360;
const COMPACT_STREAM_MIN_HEIGHT = 260;
const COMPACT_PREVIEW_MIN_HEIGHT = 420;
const RESIZE_BREAKPOINT = 980;

const ALL_SCENARIOS = [
  ...STATIC_DEMOS,
  ...DYNAMIC_PRESETS,
];

function formatChunk(msg: unknown): string {
  return JSON.stringify(msg, null, 2);
}

export function PlaybackPage(props: { protocol: Protocol; theme: Theme }) {
  const { protocol, theme } = props;

  const [scenarioId, setScenarioId] = useState<string>(
    ALL_SCENARIOS[0]?.id ?? '',
  );
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [speed, setSpeed] = useState(1);
  const [iframeKey, setIframeKey] = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const streamTimerRef = useRef<number | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingSendRef = useRef<{ msgs: unknown[]; speed: number } | null>(
    null,
  );
  const lastDeliveredCountRef = useRef(0);
  const {
    containerRef: pageRef,
    handleResizeStart: handlePanelResizeStart,
    isCompactLayout,
    isResizing: isPanelResizing,
    primaryPanelStyle: streamPanelStyle,
    secondaryPanelStyle: previewPanelStyle,
  } = useResizablePanels({
    breakpoint: RESIZE_BREAKPOINT,
    compactPrimaryMinSize: COMPACT_STREAM_MIN_HEIGHT,
    compactSecondaryMinSize: COMPACT_PREVIEW_MIN_HEIGHT,
    desktopPrimaryMinSize: DESKTOP_STREAM_MIN_WIDTH,
    desktopSecondaryMinSize: DESKTOP_PREVIEW_MIN_WIDTH,
    initialPrimarySize: 320,
    initialSecondarySize: 360,
  });

  const currentScenario = ALL_SCENARIOS.find((s) => s.id === scenarioId)
    ?? ALL_SCENARIOS[0];
  const messages = Array.isArray(currentScenario?.messages)
    ? currentScenario.messages
    : [];

  const iframeBaseUrl = useMemo(() => {
    const base = window.location.href.replace(/#.*$/, '');
    const url = new URL('render.html', base);
    url.searchParams.set('protocol', protocol.name);
    url.searchParams.set('demoUrl', DEFAULT_A2UI_DEMO_URL);
    url.searchParams.set('theme', theme);
    return url.toString();
  }, [protocol.name, theme]);

  const sendToIframe = useCallback((
    msgs: unknown[],
    spd: number,
  ) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: 'INIT_LYNX_VIEW',
        data: {
          messages: msgs,
          speed: spd,
          playbackMode: true,
          theme,
        },
      },
      '*',
    );
  }, [theme]);

  const sendPlaybackControlToIframe = useCallback(
    (action: PlaybackControlAction) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage({ type: 'A2UI_PLAYBACK_CONTROL', action }, '*');
    },
    [],
  );

  const sendPlaybackProgressToIframe = useCallback((
    deliveredCount: number,
    totalCount: number,
    status: PlaybackProgressStatus,
  ) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: 'A2UI_PLAYBACK_PROGRESS',
        data: {
          deliveredCount,
          totalCount,
          status,
        },
      },
      '*',
    );
  }, []);

  const handleIframeLoad = useCallback(() => {
    if (pendingSendRef.current !== null) {
      sendToIframe(pendingSendRef.current.msgs, pendingSendRef.current.speed);
      pendingSendRef.current = null;
    }
    if (playState === 'paused') {
      sendPlaybackControlToIframe('pause');
    }
  }, [playState, sendPlaybackControlToIframe, sendToIframe]);

  useEffect(() => () => {
    if (streamTimerRef.current !== null) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }, []);

  const startPlayback = useCallback(
    (msgs: unknown[], spd: number) => {
      setIframeKey((k) => k + 1);
      pendingSendRef.current = { msgs, speed: spd };
      setDeliveredCount(0);
      lastDeliveredCountRef.current = 0;
      setPlayState('playing');
      sendPlaybackProgressToIframe(0, msgs.length, 'streaming');
    },
    [sendPlaybackProgressToIframe],
  );

  const handleSelectScenario = useCallback(
    (id: string) => {
      setScenarioId(id);
      setPlayState('idle');
      setDeliveredCount(0);
      lastDeliveredCountRef.current = 0;
    },
    [],
  );

  const handleRestart = useCallback(() => {
    if (!currentScenario) return;
    setPlayState('idle');
    setDeliveredCount(0);
    lastDeliveredCountRef.current = 0;
    setTimeout(() => startPlayback(messages, speed), 0);
  }, [currentScenario, messages, speed, startPlayback]);

  const handlePlay = useCallback(() => {
    if (!currentScenario) return;
    handleRestart();
  }, [currentScenario, handleRestart]);

  const handlePause = useCallback(() => {
    setPlayState('paused');
    sendPlaybackControlToIframe('pause');
  }, [sendPlaybackControlToIframe]);

  const handleResume = useCallback(() => {
    if (!currentScenario) return;
    setPlayState('playing');
    sendPlaybackControlToIframe('resume');
  }, [currentScenario, sendPlaybackControlToIframe]);

  const isIdle = playState === 'idle';
  const isPlaying = playState === 'playing';
  const isPaused = playState === 'paused';
  const isDone = playState === 'done';
  const visibleMessages = messages.slice(0, Math.max(0, deliveredCount));

  useEffect(() => {
    if (isIdle) return;
    if (lastDeliveredCountRef.current === deliveredCount) return;
    lastDeliveredCountRef.current = deliveredCount;
    sendPlaybackProgressToIframe(
      deliveredCount,
      messages.length,
      isDone ? 'done' : (isPaused ? 'paused' : 'streaming'),
    );
  }, [
    deliveredCount,
    isDone,
    isIdle,
    isPaused,
    messages.length,
    sendPlaybackProgressToIframe,
  ]);

  useEffect(() => {
    if (playState !== 'playing') {
      if (streamTimerRef.current !== null) {
        clearTimeout(streamTimerRef.current);
        streamTimerRef.current = null;
      }
      return;
    }

    if (deliveredCount >= messages.length) {
      setPlayState('done');
      return;
    }

    const intervalMs = Math.max(120, Math.round(800 / Math.max(speed, 0.25)));
    streamTimerRef.current = window.setTimeout(() => {
      setDeliveredCount((count) => {
        const nextCount = Math.min(count + 1, messages.length);
        if (nextCount >= messages.length) {
          setPlayState('done');
        }
        return nextCount;
      });
    }, intervalMs);

    return () => {
      if (streamTimerRef.current !== null) {
        clearTimeout(streamTimerRef.current);
        streamTimerRef.current = null;
      }
    };
  }, [deliveredCount, messages.length, playState, speed]);

  const primaryControl = useMemo(() => {
    const restartButton = (
      <button
        type='button'
        className='toolbarBtn'
        onClick={handleRestart}
      >
        ↻ Restart
      </button>
    );
    if (isPlaying) {
      return (
        <>
          {restartButton}
          <button
            type='button'
            className='toolbarBtn'
            onClick={handlePause}
          >
            ⏸ Pause
          </button>
        </>
      );
    }
    if (isPaused) {
      return (
        <>
          {restartButton}
          <button
            type='button'
            className='toolbarBtn primary'
            onClick={handleResume}
          >
            ▶ Resume
          </button>
        </>
      );
    }
    return (
      <>
        {restartButton}
        <button
          type='button'
          className='toolbarBtn primary'
          onClick={handlePlay}
        >
          ▶ Play
        </button>
      </>
    );
  }, [
    handlePause,
    handlePlay,
    handleRestart,
    handleResume,
    isPaused,
    isPlaying,
  ]);

  return (
    <div
      ref={pageRef}
      className={isPanelResizing ? 'playbackPage resizing' : 'playbackPage'}
    >
      <div className='playbackStreamPanel' style={streamPanelStyle}>
        <div className='playbackPanelHeader'>
          <div className='playbackPanelHeaderTop'>
            <span className='playbackPanelTitle'>Playback</span>
            <span className='playbackPanelBadge'>JSONL</span>
            <select
              className='playbackScenarioSelect'
              value={scenarioId}
              onChange={(e) => handleSelectScenario(e.target.value)}
            >
              {ALL_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
            <div className='spacer' />
            <div className='playbackControls'>
              <label className='simSpeedLabel' htmlFor='pbSpeedSlider'>
                Speed
              </label>
              <input
                id='pbSpeedSlider'
                className='simSpeedSlider'
                type='range'
                min='0.25'
                max='4'
                step='0.25'
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              <span className='simSpeedValue'>{speed}x</span>
              {primaryControl}
            </div>
          </div>
          <p className='playbackPanelSubtitle'>
            Stream the scenario step by step and inspect the preview on the
            right.
          </p>
        </div>

        {messages.length > 0 && !isIdle
          ? (
            <div className='playbackProgress'>
              <div
                className='playbackProgressBar'
                style={{
                  width: `${
                    Math.round(
                      (Math.min(deliveredCount, messages.length)
                        / messages.length) * 100,
                    )
                  }%`,
                }}
              />
              <span className='playbackProgressLabel'>
                {Math.min(deliveredCount, messages.length)} / {messages.length}
                {' '}
                chunks
                {isDone
                  ? ' — complete'
                  : (isPaused ? ' — paused' : ' — streaming…')}
              </span>
            </div>
          )
          : null}

        <div className='playbackStreamBody'>
          {messages.length > 0
            ? (
              <>
                {isIdle
                  ? (
                    <div className='playbackStreamEmpty'>
                      <div className='playbackPlayIcon'>▶</div>
                      <div>Press play to stream JSONL chunks...</div>
                      <div className='playbackStreamEmptySub'>
                        {messages.length} messages · {currentScenario?.title}
                      </div>
                    </div>
                  )
                  : null}
                {visibleMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={i < deliveredCount
                      ? (i === deliveredCount - 1 && isPlaying
                        ? 'playbackChunk playbackChunkDelivered playbackChunkNew'
                        : 'playbackChunk playbackChunkDelivered')
                      : 'playbackChunk'}
                  >
                    <div className='playbackChunkHeader'>
                      <span className='playbackChunkIndex'>#{i + 1}</span>
                      {i === Math.max(0, deliveredCount - 1)
                          && isPlaying
                        ? <span className='playbackChunkLive'>live</span>
                        : null}
                    </div>
                    <pre className='playbackChunkJson'>
                      {formatChunk(msg)}
                    </pre>
                  </div>
                ))}
              </>
            )
            : (
              <div className='playbackStreamEmpty'>
                <div className='playbackPlayIcon'>◌</div>
                <div>No messages in this scenario.</div>
              </div>
            )}
        </div>
      </div>

      <PanelResizeHandle
        isActive={isPanelResizing}
        isCompactLayout={isCompactLayout}
        ariaLabel='Resize Message Stream and preview panels'
        onPointerDown={handlePanelResizeStart}
      />

      <div className='playbackPreviewPanel' style={previewPanelStyle}>
        <div className='previewPanelHeader'>
          <span className='previewPanelTitle'>Lynx Preview</span>
          {(isPlaying || isPaused || isDone) && (
            <span className='playbackStatusBadge'>
              {isPlaying
                ? 'Streaming'
                : (isPaused ? 'Paused' : 'Complete')}
            </span>
          )}
        </div>
        <div className='previewPanelBody'>
          <PreviewViewport
            key={iframeKey}
            src={isIdle ? '' : iframeBaseUrl}
            iframeRef={iframeRef}
            iframeTitle='preview'
            onLoad={handleIframeLoad}
            retainPreviousFrame
            emptyTitle='Press play to start streaming'
          />
        </div>
      </div>
    </div>
  );
}
