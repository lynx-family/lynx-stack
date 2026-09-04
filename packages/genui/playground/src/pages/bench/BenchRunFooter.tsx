// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { BenchProtocol } from './benchData.js';
import { Button } from '../../components/Button.js';
import { Pause, Play } from '../../components/Icon.js';

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

export function BenchRunFooter(props: {
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
}) {
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
    protocol === 'a2ui' ? 'A2UI' : 'OpenUI'
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
            <div
              className='benchRunMeta'
              data-tone={props.status === 'failed' ? 'error' : props.status}
              role='status'
              aria-live='polite'
            >
              {progressText}
            </div>
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
    </footer>
  );
}
