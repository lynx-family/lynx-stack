// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './PlaybackPage.css';

import { PLAYBACK_SCENARIOS } from '../demos.js';
import { DEFAULT_A2UI_DEMO_URL } from '../utils/demoUrl.js';
import type { Protocol } from '../utils/protocol.js';

type PlayState = 'idle' | 'playing' | 'paused' | 'done';

const STREAM_DELAY_MS = 800;

function formatChunk(msg: unknown): string {
  return JSON.stringify(msg, null, 2);
}

export function PlaybackPage(props: { protocol: Protocol }) {
  const { protocol } = props;

  const [scenarioId, setScenarioId] = useState<string>(
    PLAYBACK_SCENARIOS[0]?.id ?? '',
  );
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [visibleMessages, setVisibleMessages] = useState<unknown[]>([]);
  const [speed, setSpeed] = useState(1);
  const [iframeKey, setIframeKey] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamBodyRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingSendRef = useRef<{ msgs: unknown[]; speed: number } | null>(
    null,
  );

  const currentScenario = PLAYBACK_SCENARIOS.find((s) => s.id === scenarioId)
    ?? PLAYBACK_SCENARIOS[0];
  const messages = Array.isArray(currentScenario?.messages)
    ? currentScenario.messages
    : [];

  const iframeBaseUrl = useMemo(() => {
    const base = window.location.href.replace(/#.*$/, '');
    const url = new URL('render.html', base);
    url.searchParams.set('protocol', protocol.name);
    url.searchParams.set('demoUrl', DEFAULT_A2UI_DEMO_URL);
    return url.toString();
  }, [protocol.name]);

  const sendToIframe = useCallback((msgs: unknown[], spd: number) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      { type: 'INIT_LYNX_VIEW', data: { messages: msgs, speed: spd } },
      '*',
    );
  }, []);

  const handleIframeLoad = useCallback(() => {
    if (pendingSendRef.current !== null) {
      sendToIframe(pendingSendRef.current.msgs, pendingSendRef.current.speed);
      pendingSendRef.current = null;
    }
  }, [sendToIframe]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startPlayback = useCallback(
    (msgs: unknown[], spd: number) => {
      setIframeKey((k) => k + 1);
      pendingSendRef.current = { msgs, speed: spd };
      setPlayState('playing');
      setCurrentIndex(0);
      setVisibleMessages(msgs.length > 0 ? [msgs[0]] : []);
    },
    [],
  );

  useEffect(() => {
    if (playState !== 'playing') return;
    if (currentIndex >= messages.length - 1) {
      setPlayState('done');
      return;
    }
    const delay = STREAM_DELAY_MS / speed;
    timerRef.current = setTimeout(() => {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      setVisibleMessages((prev) => [...prev, messages[next]]);
    }, delay);
    return clearTimer;
  }, [playState, currentIndex, messages, speed, clearTimer]);

  useEffect(() => {
    if (!streamBodyRef.current || visibleMessages.length === 0) return;
    streamBodyRef.current.scrollTop = streamBodyRef.current.scrollHeight;
  }, [visibleMessages]);

  const handleSelectScenario = useCallback(
    (id: string) => {
      clearTimer();
      setScenarioId(id);
      setPlayState('idle');
      setCurrentIndex(-1);
      setVisibleMessages([]);
    },
    [clearTimer],
  );

  const handlePlay = useCallback(() => {
    if (!currentScenario) return;
    if (playState === 'paused') {
      setPlayState('playing');
      return;
    }
    clearTimer();
    setVisibleMessages([]);
    setCurrentIndex(-1);
    setPlayState('idle');
    setTimeout(() => startPlayback(messages, speed), 0);
  }, [playState, currentScenario, messages, speed, clearTimer, startPlayback]);

  const handlePause = useCallback(() => {
    clearTimer();
    setPlayState('paused');
  }, [clearTimer]);

  const handleRestart = useCallback(() => {
    if (!currentScenario) return;
    clearTimer();
    setVisibleMessages([]);
    setCurrentIndex(-1);
    setPlayState('idle');
    setTimeout(() => startPlayback(messages, speed), 0);
  }, [currentScenario, messages, speed, clearTimer, startPlayback]);

  const isIdle = playState === 'idle';
  const isPlaying = playState === 'playing';
  const isDone = playState === 'done';
  const isPaused = playState === 'paused';
  const showIframe = !isIdle;

  return (
    <div className='playbackPage'>
      <aside className='sidebar'>
        <div className='sidebarSection'>
          <div className='sidebarHeading'>Scenarios</div>
          <div className='scenarioList'>
            {PLAYBACK_SCENARIOS.map((s) => (
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

      <div className='playbackStreamPanel'>
        <div className='playbackPanelHeader'>
          <span className='playbackPanelTitle'>JSONL Stream</span>
          <span className='playbackPanelBadge'>JSONL</span>
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
            {isPlaying
              ? (
                <button
                  type='button'
                  className='toolbarBtn'
                  onClick={handlePause}
                >
                  ⏸ Pause
                </button>
              )
              : (
                <button
                  type='button'
                  className='toolbarBtn primary'
                  onClick={handlePlay}
                >
                  ▶ Play
                </button>
              )}
            {(isDone || isPaused) && (
              <button
                type='button'
                className='toolbarBtn'
                onClick={handleRestart}
              >
                ↺ Restart
              </button>
            )}
          </div>
        </div>

        {!isIdle && messages.length > 0 && (
          <div className='playbackProgress'>
            <div
              className='playbackProgressBar'
              style={{
                width: `${
                  Math.round(((currentIndex + 1) / messages.length) * 100)
                }%`,
              }}
            />
            <span className='playbackProgressLabel'>
              {currentIndex + 1} / {messages.length} chunks
              {isDone ? ' — complete' : (isPlaying ? ' — streaming…' : '')}
            </span>
          </div>
        )}

        <div className='playbackStreamBody' ref={streamBodyRef}>
          {isIdle
            ? (
              <div className='playbackStreamEmpty'>
                <div className='playbackPlayIcon'>▶</div>
                <div>Press play to stream JSONL chunks...</div>
                {messages.length > 0 && (
                  <div className='playbackStreamEmptySub'>
                    {messages.length} messages · {currentScenario?.title}
                  </div>
                )}
              </div>
            )
            : (
              <>
                {visibleMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={i === visibleMessages.length - 1 && isPlaying
                      ? 'playbackChunk playbackChunkNew'
                      : 'playbackChunk'}
                  >
                    <div className='playbackChunkHeader'>
                      <span className='playbackChunkIndex'>#{i + 1}</span>
                      {i === visibleMessages.length - 1 && isPlaying && (
                        <span className='playbackChunkLive'>live</span>
                      )}
                    </div>
                    <pre className='playbackChunkJson'>
                      {formatChunk(msg)}
                    </pre>
                  </div>
                ))}
              </>
            )}
        </div>
      </div>

      <div className='playbackPreviewPanel'>
        <div className='previewPanelHeader'>
          <span className='previewPanelTitle'>Lynx Preview</span>
          {(isPlaying || isDone || isPaused) && (
            <span className='playbackStatusBadge'>
              {isPlaying
                ? 'Streaming'
                : (isDone
                  ? 'Complete'
                  : 'Paused')}
            </span>
          )}
        </div>
        <div className='previewPanelBody'>
          {showIframe
            ? (
              <div className='phoneWrap'>
                <div className='phoneFrame'>
                  <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    className='phoneIframe'
                    title='preview'
                    src={iframeBaseUrl}
                    onLoad={handleIframeLoad}
                  />
                </div>
              </div>
            )
            : (
              <div className='previewEmpty'>
                <div className='previewEmptyIcon'>▶</div>
                <div>Press play to start streaming</div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
