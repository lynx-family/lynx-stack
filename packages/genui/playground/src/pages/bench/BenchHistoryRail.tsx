// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Button } from '../../components/Button.js';
import {
  Copy,
  History,
  MessageSquarePlus,
  Trash2,
} from '../../components/Icon.js';
import { PageHeader } from '../../components/PageHeader.js';

interface BenchHistoryRailEntry {
  config: { env: { model: string } };
  id: string;
  report: {
    jobId?: string;
    results: readonly unknown[];
    summary?: { totalRuns: number };
  } | null;
  savedAt: string;
  title: string;
}

export function BenchHistoryRail<T extends BenchHistoryRailEntry>(props: {
  activeId: string | null;
  copyId: string | null;
  disabled: boolean;
  entries: readonly T[];
  onClear: () => void;
  onCopy: (entry: T) => Promise<void> | void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onRestore: (entry: T) => void;
}) {
  return (
    <aside className='benchHistoryRail' aria-label='Bench history'>
      <div className='benchHistoryRailCreate'>
        <Button
          variant='secondary'
          size='lg'
          fullWidth
          iconBefore={MessageSquarePlus}
          disabled={props.disabled}
          onClick={props.onNew}
        >
          New Bench
        </Button>
      </div>
      <PageHeader
        className='benchHistoryRailHeader'
        title='History'
        topContent={<span>{props.entries.length}</span>}
      />
      <div className='benchHistoryRailList'>
        {props.entries.length > 0
          ? props.entries.map((entry) => {
            const totalRuns = entry.report?.summary?.totalRuns
              ?? entry.report?.results.length
              ?? 0;
            const jobId = entry.report?.jobId;
            return (
              <article
                className='benchHistoryRailItem'
                data-active={props.activeId === entry.id || undefined}
                key={entry.id}
              >
                <button
                  type='button'
                  className='benchHistoryRailItemMain'
                  disabled={props.disabled}
                  onClick={() => props.onRestore(entry)}
                >
                  <strong>{entry.title}</strong>
                  <span>
                    {new Date(entry.savedAt).toLocaleString('en-US')}
                  </span>
                  <small>
                    {entry.report
                      ? `${totalRuns} Runs · ${entry.config.env.model}`
                      : `Draft · ${entry.config.env.model}`}
                  </small>
                </button>
                <div className='benchHistoryRailItemActions'>
                  <Button
                    variant='ghost'
                    size='sm'
                    iconOnly
                    iconBefore={Copy}
                    disabled={props.disabled || !jobId}
                    aria-label={`Copy recovery link for ${entry.title}`}
                    title={props.copyId === entry.id ? 'Copied' : 'Copy link'}
                    onClick={() => void props.onCopy(entry)}
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
          })
          : (
            <div className='benchHistoryRailEmpty'>
              <History aria-hidden='true' />
              <span>Completed runs will appear here</span>
            </div>
          )}
      </div>
      <button
        type='button'
        className='benchHistoryRailClear'
        disabled={props.disabled || props.entries.length === 0}
        onClick={props.onClear}
      >
        Clear history
      </button>
    </aside>
  );
}
