// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

import type { BenchGroup, BenchScenario, BenchSettings } from './benchData.js';
import type { BenchReport, BenchResult } from './benchReportTypes.js';
import { Button } from '../../components/Button.js';
import { X } from '../../components/Icon.js';
import { PanelResizeHandle } from '../../components/PanelResizeHandle.js';

type BenchScreenshotState = 'captured' | 'failed' | 'missing';

interface BenchScreenshotSlot {
  key: string;
  repeatIndex: number;
  result: BenchResult | null;
  state: BenchScreenshotState;
}

interface BenchScreenshotMatrixCell {
  key: string;
  group: BenchGroup;
  scenario: BenchScenario;
  slots: BenchScreenshotSlot[];
}

interface BenchScreenshotMatrixRow {
  cells: BenchScreenshotMatrixCell[];
  group: BenchGroup;
  key: string;
}

interface BenchScreenshotMatrix {
  captured: number;
  failed: number;
  missing: number;
  repeatCount: number;
  rows: BenchScreenshotMatrixRow[];
  scenarios: BenchScenario[];
  total: number;
}

const SCREENSHOT_DIALOG_DEFAULT_WIDTH = 1040;
const SCREENSHOT_DIALOG_MIN_WIDTH = 720;
const SCREENSHOT_DIALOG_MAX_WIDTH = 1440;
const SCREENSHOT_DIALOG_WIDTH_STORAGE_KEY =
  'a2ui-bench-screenshot-dialog-width';

function clampScreenshotDialogWidth(value: number): number {
  const viewportMax = typeof window === 'undefined'
    ? SCREENSHOT_DIALOG_MAX_WIDTH
    : Math.max(320, window.innerWidth - 48);
  const max = Math.max(
    Math.min(SCREENSHOT_DIALOG_MIN_WIDTH, viewportMax),
    Math.min(SCREENSHOT_DIALOG_MAX_WIDTH, viewportMax),
  );
  const min = Math.min(SCREENSHOT_DIALOG_MIN_WIDTH, max);
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getInitialScreenshotDialogWidth(): number {
  if (typeof window === 'undefined') return SCREENSHOT_DIALOG_DEFAULT_WIDTH;
  try {
    const stored = Number(
      window.localStorage.getItem(SCREENSHOT_DIALOG_WIDTH_STORAGE_KEY),
    );
    return clampScreenshotDialogWidth(
      stored || window.innerWidth * 0.86,
    );
  } catch {
    return clampScreenshotDialogWidth(window.innerWidth * 0.86);
  }
}

function formatMs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function formatRunJudgeMetric(
  report: BenchReport,
  settings: BenchSettings,
  result: BenchResult,
): string {
  if (!settings.judgeEnabled || report.capabilities?.judge === 'disabled') {
    return 'off';
  }
  if (result.judgeStatus === 'failed') return 'error';
  if (result.judgeStatus === 'skipped') return 'n/a';
  const visual = `${result.judgeScore.toFixed(1)}/5`;
  return result.judgeGeqiScore === undefined
    ? visual
    : `${visual} · ${result.judgeGeqiScore.toFixed(1)}/100 GEQI`;
}

function isBenchRunFailed(result: BenchResult): boolean {
  return result.status === 'failed' || result.ok === false;
}

function getScreenshotState(result: BenchResult): BenchScreenshotState {
  if (result.screenshotDataUrl) return 'captured';
  if (isBenchRunFailed(result)) return 'failed';
  return 'missing';
}

function getScreenshotStateLabel(state: BenchScreenshotState): string {
  if (state === 'captured') return 'Captured';
  if (state === 'failed') return 'Run failed';
  return 'No screenshot';
}

function getScreenshotPlaceholderText(result: BenchResult | null): string {
  if (!result) return 'No Bench result was received for this slot.';
  if (isBenchRunFailed(result)) {
    return result.error
      ?? result.errors?.[0]
      ?? 'The run failed before a screenshot was captured.';
  }
  return result.errors?.find((error) =>
    error.toLowerCase().includes('screenshot')
  ) ?? 'This run did not save a screenshot.';
}

function createMatrixGroups(report: BenchReport): BenchGroup[] {
  if (report.groups.length > 0) return report.groups;
  const seen = new Set<string>();
  return report.results.flatMap((result) => {
    if (seen.has(result.groupId)) return [];
    seen.add(result.groupId);
    return [{
      catalog: result.catalog ?? 'Full Catalog',
      enabled: true,
      extraInstruction: '',
      id: result.groupId,
      model: result.model ?? report.env.model,
      name: result.groupName,
      profile: result.profile
        ?? (result.protocol === 'openui' ? 'matched-core' : 'native'),
      protocol: result.protocol ?? 'a2ui',
      role: result.role,
      variable: 'custom' as const,
    }];
  });
}

function createMatrixScenarios(report: BenchReport): BenchScenario[] {
  if (report.scenarios.length > 0) return report.scenarios;
  const seen = new Set<string>();
  return report.results.flatMap((result) => {
    if (seen.has(result.scenarioId)) return [];
    seen.add(result.scenarioId);
    return [{
      action: '',
      complexity: 1,
      id: result.scenarioId,
      name: result.scenarioName,
      prompt: '',
      type: 'Custom',
    }];
  });
}

function createScreenshotMatrix(
  report: BenchReport,
  repeatCount: number,
): BenchScreenshotMatrix {
  const groups = createMatrixGroups(report);
  const scenarios = createMatrixScenarios(report);
  const normalizedRepeatCount = Math.max(1, repeatCount);
  const resultsByCell = new Map<string, BenchResult[]>();
  for (const result of report.results) {
    const key = `${result.groupId}:${result.scenarioId}`;
    const results = resultsByCell.get(key) ?? [];
    results.push(result);
    resultsByCell.set(key, results);
  }

  let captured = 0;
  let failed = 0;
  let missing = 0;
  const rows = groups.map((group) => ({
    key: group.id,
    group,
    cells: scenarios.map((scenario) => {
      const results = [
        ...(resultsByCell.get(`${group.id}:${scenario.id}`) ?? []),
      ].sort((left, right) =>
        (left.repeatIndex ?? 1) - (right.repeatIndex ?? 1)
      );
      const slots = Array.from(
        { length: normalizedRepeatCount },
        (_, index): BenchScreenshotSlot => {
          const repeatIndex = index + 1;
          const result = results.find((item) =>
            (item.repeatIndex ?? 1) === repeatIndex
          ) ?? null;
          const state = result ? getScreenshotState(result) : 'missing';
          if (state === 'captured') captured += 1;
          else if (state === 'failed') failed += 1;
          else missing += 1;
          return {
            key: result?.id ?? `${group.id}:${scenario.id}:${repeatIndex}`,
            repeatIndex,
            result,
            state,
          };
        },
      );
      return {
        key: `${group.id}:${scenario.id}`,
        group,
        scenario,
        slots,
      };
    }),
  }));
  return {
    captured,
    failed,
    missing,
    repeatCount: normalizedRepeatCount,
    rows,
    scenarios,
    total: groups.length * scenarios.length * normalizedRepeatCount,
  };
}

export function BenchScreenshotsDialog(props: {
  onClose: () => void;
  open: boolean;
  report: BenchReport | null;
  settings: BenchSettings;
}) {
  const [width, setWidth] = useState(getInitialScreenshotDialogWidth);
  const [isResizing, setIsResizing] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const matrix = useMemo(
    () =>
      props.report
        ? createScreenshotMatrix(props.report, props.settings.repeats)
        : null,
    [props.report, props.settings.repeats],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SCREENSHOT_DIALOG_WIDTH_STORAGE_KEY,
        String(width),
      );
    } catch {
      // Resizing remains available when localStorage cannot be written.
    }
  }, [width]);

  const startResize = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.currentTarget.focus();
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = event.clientX;
    const startWidth = rect.width;
    setIsResizing(true);
    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      setWidth(clampScreenshotDialogWidth(
        startWidth + moveEvent.clientX - startX,
      ));
    };
    const stopResize = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    };
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  }, []);

  const nudgeWidth = useCallback((
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    setWidth((current) =>
      clampScreenshotDialogWidth(
        current + direction * 32,
      )
    );
  }, []);

  if (!props.open || !props.report || !matrix) return null;
  const matrixStyle = {
    '--bench-screenshot-scenario-count': Math.max(1, matrix.scenarios.length),
  } as CSSProperties;
  const dialogStyle = {
    '--bench-screenshot-dialog-width': `${width}px`,
  } as CSSProperties;

  return (
    <div
      className='benchConfigOverlay'
      role='presentation'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <section
        ref={dialogRef}
        className='benchConfigDialog benchScreenshotDialog'
        role='dialog'
        aria-modal='true'
        aria-labelledby='bench-screenshots-title'
        style={dialogStyle}
      >
        <header className='benchConfigHeader'>
          <div>
            <h2 id='bench-screenshots-title' className='benchConfigTitle'>
              Run screenshots
            </h2>
            <p className='benchConfigSub'>
              {`${matrix.rows.length} comparison groups × ${matrix.scenarios.length} scenarios · ${matrix.repeatCount} repeats`}
            </p>
          </div>
          <Button
            variant='secondary'
            size='sm'
            iconOnly
            iconBefore={X}
            aria-label='Close screenshots'
            title='Close screenshots'
            onClick={props.onClose}
          />
        </header>

        <div className='benchScreenshotBody'>
          <div className='benchScreenshotSummaryGrid'>
            <div>
              <span>Runs</span>
              <strong>{formatNumber(matrix.total)}</strong>
            </div>
            <div>
              <span>Captured</span>
              <strong>{formatNumber(matrix.captured)}</strong>
            </div>
            <div>
              <span>Failed</span>
              <strong>{formatNumber(matrix.failed)}</strong>
            </div>
            <div>
              <span>Missing</span>
              <strong>{formatNumber(matrix.missing)}</strong>
            </div>
          </div>

          <div className='benchScreenshotMatrixWrap'>
            <div className='benchScreenshotMatrix' style={matrixStyle}>
              <div className='benchScreenshotMatrixCorner'>
                Comparison group
              </div>
              {matrix.scenarios.map((scenario) => (
                <div
                  className='benchScreenshotScenarioHeader'
                  key={scenario.id}
                >
                  <strong>{scenario.name}</strong>
                  <span>{scenario.type}</span>
                </div>
              ))}
              {matrix.rows.map((row) => (
                <div className='benchScreenshotMatrixRow' key={row.key}>
                  <div className='benchScreenshotGroupHeader'>
                    <span
                      className={`benchRoleDot ${row.group.role}`}
                      aria-hidden='true'
                    />
                    <div>
                      <strong>{row.group.name}</strong>
                      <span>
                        {row.group.protocol === 'openui' ? 'OpenUI' : 'A2UI'}
                        {' · '}
                        {row.group.profile}
                      </span>
                    </div>
                  </div>
                  {row.cells.map((cell) => (
                    <div className='benchScreenshotMatrixCell' key={cell.key}>
                      {cell.slots.map((slot) => {
                        const item = slot.result;
                        return (
                          <article
                            className='benchScreenshotSlot'
                            data-state={slot.state}
                            key={slot.key}
                          >
                            <div className='benchScreenshotSlotHeader'>
                              <strong>#{slot.repeatIndex}</strong>
                              <span
                                className='benchScreenshotState'
                                data-state={slot.state}
                              >
                                {getScreenshotStateLabel(slot.state)}
                              </span>
                            </div>
                            {item?.screenshotDataUrl
                              ? (
                                <div className='benchScreenshotImageFrame'>
                                  <img
                                    alt={`${cell.group.name} ${cell.scenario.name} #${slot.repeatIndex}`}
                                    src={item.screenshotDataUrl}
                                  />
                                </div>
                              )
                              : (
                                <div className='benchScreenshotPlaceholder'>
                                  <strong>
                                    {getScreenshotStateLabel(slot.state)}
                                  </strong>
                                  <span>
                                    {getScreenshotPlaceholderText(item)}
                                  </span>
                                </div>
                              )}
                            <div className='benchScreenshotSlotMeta'>
                              {item
                                ? (
                                  <>
                                    <span>
                                      Judge {formatRunJudgeMetric(
                                        props.report,
                                        props.settings,
                                        item,
                                      )}
                                    </span>
                                    <span>{formatMs(item.agentMs)}</span>
                                    <span>
                                      {formatNumber(item.tokens)} tokens
                                    </span>
                                  </>
                                )
                                : <span>No result</span>}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className='benchConfigFooter'>
          <Button variant='primary' size='sm' onClick={props.onClose}>
            Done
          </Button>
        </footer>
        <PanelResizeHandle
          className='benchScreenshotResizeHandle'
          ariaLabel='Resize screenshot dialog'
          ariaValueMin={SCREENSHOT_DIALOG_MIN_WIDTH}
          ariaValueMax={SCREENSHOT_DIALOG_MAX_WIDTH}
          ariaValueNow={width}
          isActive={isResizing}
          isCompactLayout={false}
          onKeyDown={nudgeWidth}
          onPointerDown={startResize}
        />
      </section>
    </div>
  );
}
