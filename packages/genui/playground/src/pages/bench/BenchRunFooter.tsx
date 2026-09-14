// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';

import { getBenchProtocolLabel } from './benchData.js';
import type { BenchProtocol } from './benchData.js';
import { formatBenchDuration } from './benchTiming.js';
import type { BenchLiveTiming } from './benchTiming.js';
import { Button } from '../../components/Button.js';
import { ChevronLeft, Pause, Play } from '../../components/Icon.js';

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
  const workflowId = useId();
  useEffect(() => {
    if (props.status === 'idle') setWorkflowOpen(false);
  }, [props.status]);
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
    <footer className='benchRunFooter' data-status={props.status}>
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
      {props.status !== 'idle' && workflowOpen && props.workflow && (
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
