// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';

import { getBenchProtocolLabel } from './benchData.js';
import type { BenchProtocol } from './benchData.js';
import { formatBenchDuration } from './benchTiming.js';
import type { BenchLiveTiming } from './benchTiming.js';
import { Button } from '../../components/Button.js';
import { ChevronLeft, Pause, Play } from '../../components/Icon.js';
import { PanelResizeHandle } from '../../components/PanelResizeHandle.js';

const MIN_FOOTER_HEIGHT = 180;
const MIN_PLAN_HEIGHT = 160;
const RESIZE_STEP = 24;

type BenchRunFooterStatus =
  | 'idle'
  | 'running'
  | 'complete'
  | 'failed'
  | 'cancelled';

export function getRunButtonText(status: BenchRunFooterStatus): string {
  return status === 'running' ? 'Pause' : 'Start run';
}

export function isBenchRunPlanComplete(
  protocols: readonly BenchProtocol[],
  groupCount: number,
  scenarioCount: number,
  runCount: number,
): boolean {
  return protocols.length > 0
    && groupCount > 0
    && scenarioCount > 0
    && runCount > 0;
}

function getProgressValue(
  status: BenchRunFooterStatus,
  progress: number,
  reportAvailable: boolean,
): number {
  if (status === 'running') return progress;
  if (progress > 0) return progress;
  return reportAvailable ? 100 : 0;
}

function getProgressText(
  status: BenchRunFooterStatus,
  progress: number,
  messageText: string,
  runCount: number,
): string {
  if (status === 'running') {
    return `${Math.round(progress)}% · ${messageText}`;
  }
  if (status === 'idle') return `${runCount} runs planned`;
  return messageText;
}

function BenchElapsedTime(props: {
  durationMs?: number;
  liveTiming?: BenchLiveTiming | null;
  running: boolean;
}) {
  const { durationMs, liveTiming, running } = props;
  const [elapsedMs, setElapsedMs] = useState(liveTiming?.durationMs);
  useEffect(() => {
    if (!liveTiming) {
      setElapsedMs(undefined);
      return;
    }
    const update = () => {
      setElapsedMs(
        liveTiming.durationMs
          + Math.max(0, performance.now() - liveTiming.receivedAtMs),
      );
    };
    update();
    if (!running || durationMs !== undefined) return;
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [durationMs, liveTiming, running]);
  return (
    <div className='benchRunTiming'>
      Total time <strong>{formatBenchDuration(durationMs ?? elapsedMs)}</strong>
    </div>
  );
}

export function BenchRunFooter(props: {
  durationMs?: number;
  liveTiming?: BenchLiveTiming | null;
  groupCount: number;
  messageText: string;
  onAction: () => void;
  progress: number;
  protocols: readonly BenchProtocol[];
  readOnly: boolean;
  reportAvailable: boolean;
  runCount: number;
  scenarioCount: number;
  status: BenchRunFooterStatus;
  workflow?: ReactNode;
}) {
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [footerHeight, setFooterHeight] = useState<number>();
  const [maxFooterHeight, setMaxFooterHeight] = useState(600);
  const [drag, setDrag] = useState<
    {
      pointerId: number;
      startY: number;
      startHeight: number;
      handle: HTMLDivElement;
    } | null
  >(null);
  const footerRef = useRef<HTMLElement>(null);
  const workflowId = useId();
  const hasWorkflow = props.status !== 'idle' && Boolean(props.workflow);
  const workflowVisible = hasWorkflow && workflowOpen;
  useEffect(() => {
    if (!hasWorkflow) setWorkflowOpen(false);
  }, [hasWorkflow]);
  useEffect(() => {
    if (!workflowVisible) setDrag(null);
  }, [workflowVisible]);

  useEffect(() => {
    const parent = footerRef.current?.parentElement;
    if (!parent) return;
    const updateLimit = () => {
      const height = parent.getBoundingClientRect().height
        || window.innerHeight;
      const maximum = Math.max(MIN_FOOTER_HEIGHT, height - MIN_PLAN_HEIGHT);
      setMaxFooterHeight(maximum);
      setFooterHeight(current =>
        current === undefined ? current : Math.min(current, maximum)
      );
    };
    updateLimit();
    const observer = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(updateLimit);
    observer?.observe(parent);
    window.addEventListener('resize', updateLimit);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateLimit);
    };
  }, []);

  useEffect(() => {
    if (!drag) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const move = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      setFooterHeight(Math.max(
        MIN_FOOTER_HEIGHT,
        Math.min(
          maxFooterHeight,
          drag.startHeight + drag.startY - event.clientY,
        ),
      ));
    };
    const stop = (event: globalThis.PointerEvent) => {
      if (event.pointerId === drag.pointerId) setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      if (drag.handle.hasPointerCapture?.(drag.pointerId)) {
        drag.handle.releasePointerCapture(drag.pointerId);
      }
    };
  }, [drag, maxFooterHeight]);

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: footerRef.current?.getBoundingClientRect().height
        ?? MIN_FOOTER_HEIGHT,
      handle: event.currentTarget,
    });
  };
  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setDrag(null);
      return;
    }
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = footerHeight
      ?? footerRef.current?.getBoundingClientRect().height ?? MIN_FOOTER_HEIGHT;
    const next = event.key === 'Home'
      ? MIN_FOOTER_HEIGHT
      : (event.key === 'End'
        ? maxFooterHeight
        : current + (event.key === 'ArrowUp' ? RESIZE_STEP : -RESIZE_STEP));
    setFooterHeight(
      Math.max(MIN_FOOTER_HEIGHT, Math.min(maxFooterHeight, next)),
    );
  };
  const isRunning = props.status === 'running';
  const progressValue = getProgressValue(
    props.status,
    props.progress,
    props.reportAvailable,
  );
  const progressText = getProgressText(
    props.status,
    props.progress,
    props.messageText,
    props.runCount,
  );
  const protocolLabel = props.protocols.map((protocol) =>
    getBenchProtocolLabel(protocol)
  ).join(' + ');
  const planComplete = isBenchRunPlanComplete(
    props.protocols,
    props.groupCount,
    props.scenarioCount,
    props.runCount,
  );

  return (
    <footer
      className='benchRunFooter'
      ref={footerRef}
      data-status={props.status}
      data-workflow-open={workflowVisible || undefined}
      data-workflow-sized={workflowVisible && footerHeight !== undefined
        || undefined}
      style={workflowVisible
        ? { height: footerHeight, maxHeight: maxFooterHeight }
        : undefined}
    >
      {workflowVisible && (
        <PanelResizeHandle
          className='benchRunResizeHandle'
          ariaLabel='Resize run workflow'
          ariaValueMin={MIN_FOOTER_HEIGHT}
          ariaValueMax={maxFooterHeight}
          ariaValueNow={workflowVisible ? footerHeight : undefined}
          isActive={drag !== null}
          isCompactLayout
          onPointerDown={startResize}
          onKeyDown={resizeWithKeyboard}
          title='Drag to resize. Use Up and Down arrows to resize.'
        />
      )}
      {props.status === 'idle'
        ? (
          <div className='benchPlanSummary' aria-label='Current run plan'>
            <span>
              <strong>{protocolLabel || 'Not selected'}</strong>
              <small>Protocol</small>
            </span>
            <span>
              <strong>{props.groupCount}</strong>
              <small>Groups</small>
            </span>
            <span>
              <strong>{props.scenarioCount}</strong>
              <small>Scenarios</small>
            </span>
            <span>
              <strong>{props.runCount}</strong>
              <small>Runs</small>
            </span>
          </div>
        )
        : (
          <div className='benchRunProgress'>
            <Button
              className='benchRunProgressToggle'
              variant='ghost'
              size='sm'
              iconAfter={props.workflow ? ChevronLeft : undefined}
              aria-label={workflowOpen
                ? 'Hide run workflow'
                : 'Show run workflow'}
              aria-expanded={workflowOpen}
              aria-controls={workflowId}
              disabled={!props.workflow}
              onClick={() => setWorkflowOpen(open => !open)}
            >
              <span
                className='benchRunMeta'
                data-tone={props.status === 'failed' ? 'error' : props.status}
                role='status'
                aria-live='polite'
              >
                {progressText}
              </span>
            </Button>
            {(props.reportAvailable || props.liveTiming) && (
              <BenchElapsedTime
                durationMs={props.durationMs}
                liveTiming={props.liveTiming}
                running={isRunning}
              />
            )}
            <div
              className='benchProgressTrack'
              role='progressbar'
              aria-label='Bench progress'
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressValue)}
            >
              <div
                className='benchProgressBar'
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
        )}
      <div className='benchRunActions benchRunActionsBottom'>
        <Button
          variant='primary'
          size='lg'
          iconBefore={isRunning ? Pause : Play}
          disabled={!isRunning && (!planComplete || props.readOnly)}
          onClick={props.onAction}
        >
          {getRunButtonText(props.status)}
        </Button>
      </div>
      {workflowVisible && (
        <div
          className='benchRunWorkflow'
          id={workflowId}
          role='region'
          aria-label='Run workflow'
        >
          {props.workflow}
        </div>
      )}
    </footer>
  );
}
