// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useRef, useState } from 'react';

import { formatBenchDuration } from './benchTiming.js';
import { Button } from '../../components/Button.js';
import { HistoryRailShell } from '../../components/HistoryRailShell.js';
import { Copy, History, Pencil, Trash2 } from '../../components/Icon.js';

interface BenchHistoryRailEntry {
  config: { env: { model: string } };
  id: string;
  report: {
    durationMs?: number;
    jobId?: string;
    results: readonly unknown[];
    summary?: { totalRuns: number };
  } | null;
  savedAt: string;
  title: string;
}

export function BenchHistoryRail<T extends BenchHistoryRailEntry>(props: {
  activeId: string | null;
  disabled: boolean;
  entries: readonly T[];
  onClear: () => void;
  onOpenReport: (entry: T) => void;
  onDelete: (id: string) => void;
  onCopy?: (entry: T) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onRestore: (entry: T) => void;
  reportNotice?: string;
  storageNotice?: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const cancelRenameRef = useRef(false);

  const commitRename = () => {
    if (!editingId) return;
    const title = draftTitle.trim();
    if (!props.disabled && title) props.onRename(editingId, title);
    setEditingId(null);
  };

  return (
    <HistoryRailShell
      className='benchHistoryRail'
      ariaLabel='Bench history'
      createLabel='New Bench'
      count={props.entries.length}
      disabled={props.disabled}
      listClassName='benchHistoryRailList'
      onCreate={props.onNew}
      empty={
        <div className='benchHistoryRailEmpty'>
          <History aria-hidden='true' />
          <span>Completed runs will appear here</span>
        </div>
      }
      footer={
        <>
          {props.reportNotice && (
            <p className='benchHistoryShareNotice' role='status'>
              {props.reportNotice}
            </p>
          )}
          {props.storageNotice && (
            <p className='benchHistoryShareNotice' role='alert'>
              {props.storageNotice}
            </p>
          )}
          <button
            type='button'
            className='benchHistoryRailClear'
            disabled={props.disabled || props.entries.length === 0}
            onClick={props.onClear}
          >
            Clear history
          </button>
        </>
      }
    >
      {props.entries.map((entry) => {
        const totalRuns = entry.report?.summary?.totalRuns
          ?? entry.report?.results.length
          ?? 0;
        const details = (
          <>
            <span>{new Date(entry.savedAt).toLocaleString('en-US')}</span>
            <small>
              {entry.report
                ? `${totalRuns} Runs · ${entry.config.env.model}`
                : `Draft · ${entry.config.env.model}`}
            </small>
            {entry.report && (
              <small>
                Total time: {formatBenchDuration(entry.report.durationMs)}
              </small>
            )}
          </>
        );
        return (
          <article
            className='benchHistoryRailItem'
            data-active={props.activeId === entry.id || undefined}
            key={entry.id}
          >
            {editingId === entry.id
              ? (
                <div className='benchHistoryRailItemMain'>
                  <input
                    className='benchHistoryRenameInput'
                    aria-label='Bench name'
                    value={draftTitle}
                    disabled={props.disabled}
                    autoFocus
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing) return;
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        cancelRenameRef.current = true;
                        commitRename();
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelRenameRef.current = true;
                        setEditingId(null);
                      }
                    }}
                    onBlur={() => {
                      if (!cancelRenameRef.current) commitRename();
                      cancelRenameRef.current = false;
                    }}
                  />
                  {details}
                </div>
              )
              : (
                <button
                  type='button'
                  className='benchHistoryRailItemMain'
                  disabled={props.disabled}
                  onClick={() => props.onRestore(entry)}
                >
                  <strong title={entry.title}>{entry.title}</strong>
                  {details}
                </button>
              )}
            <div className='benchHistoryRailItemActions'>
              <Button
                variant='ghost'
                size='sm'
                iconOnly
                iconBefore={Pencil}
                disabled={props.disabled}
                aria-label={`Rename ${entry.title}`}
                title='Rename'
                onClick={() => {
                  cancelRenameRef.current = false;
                  setEditingId(entry.id);
                  setDraftTitle(entry.title);
                }}
              />
              <Button
                variant='ghost'
                size='sm'
                iconOnly
                iconBefore={Copy}
                disabled={props.disabled || !props.onCopy}
                aria-label={`Copy ${entry.title}`}
                title='Copy as new Bench'
                onClick={() => props.onCopy?.(entry)}
              />
              <Button
                variant='danger'
                size='sm'
                iconOnly
                iconBefore={Trash2}
                disabled={props.disabled}
                aria-label={`Delete ${entry.title}`}
                title='Delete'
                onClick={() => props.onDelete(entry.id)}
              />
            </div>
          </article>
        );
      })}
    </HistoryRailShell>
  );
}
