import { h } from 'preact';
import { Actions, ActionSeparator } from '../../../Actions';
import { CommitTimeline } from '../CommitTimeline/CommitTimeline';
import { IconBtn } from '../../../IconBtn';
import { useStore } from '../../../../store/react-bindings';
import treeBarStyles from '../../../elements/TreeBar.module.css';
import { useCallback, useState } from 'preact/hooks';
import { FlameGraphMode } from '../../flamegraph/FlameGraphMode';
import {
  getCommitInitialSelectNodeId,
  resetProfiler,
  startProfiling,
  stopProfiling,
} from '../../data/commits';
import { Icon } from '../../../icons';
import { useComputed } from '@preact/signals';
import { OutsideClick } from '../../../OutsideClick';
import { FilterNumber, FilterPopup } from '../../../FilterPopup/FilterPopup';
import filterBarStyles from '../../../FilterPopup/FilterPopup.module.css';
import s from './TimelineBar.module.css';

export function TimelineBar() {
  const store = useStore();
  const commits = store.profiler.commits.value;
  const filteredCommits = store.profiler.filteredCommits.value;
  const isRecording = store.profiler.isRecording.value;
  const isSupported = store.profiler.isSupported.value;
  const selectedCommit = store.profiler.activeCommitIdx.value;

  const [filterVisible, setFilterVisible] = useState(false);

  const stats = useComputed(() => {
    return {
      max: Math.max(16, ...store.profiler.commits.value.map(x => x.duration)),
      min: Math.max(
        0,
        Math.min(...store.profiler.commits.value.map(x => x.duration)),
      ),
    };
  }).value;

  const onCommitChange = useCallback(
    (n: number) => {
      const {
        activeCommitIdx,
        selectedNodeId,
        activeCommit,
        flamegraphType,
      } = store.profiler;

      activeCommitIdx.value = n;
      const commit = activeCommit.value;
      if (!commit) return;

      selectedNodeId.value = getCommitInitialSelectNodeId(
        commit,
        flamegraphType.value,
      );
    },
    [store],
  );

  const onReloadAndProfile = useCallback(() => {
    startProfiling(store.profiler);
    store.emit('reload-and-profile', {
      captureRenderReasons: store.profiler.captureRenderReasons.value,
    });
  }, []);

  const onReset = useCallback(() => {
    resetProfiler(store.profiler);
    store.emit('stop-profiling', null);
  }, [store]);

  return (
    <Actions>
      <div class={treeBarStyles.btnWrapper}>
        <RecordBtn />
      </div>
      <div class={treeBarStyles.btnWrapper}>
        <IconBtn
          title='Reload and profile'
          disabled={!isSupported || isRecording}
          testId='reload-and-profile-btn'
          onClick={onReloadAndProfile}
        >
          <Icon icon='refresh' />
        </IconBtn>
      </div>
      <div class={treeBarStyles.btnWrapper}>
        <IconBtn
          title='Clear profiling data'
          disabled={!isSupported || commits.length === 0 || isRecording}
          onClick={onReset}
        >
          <Icon icon='not-interested' />
        </IconBtn>
      </div>
      <ActionSeparator />
      <FlameGraphMode />
      <ActionSeparator />
      {isSupported && !isRecording && (
        <CommitTimeline
          items={filteredCommits.map(commit => {
            const percent = ((commit.duration - stats.min) * 100)
              / (stats.max - stats.min || 0.1);
            return { percent, index: commit.index };
          })}
          selected={selectedCommit}
          onChange={onCommitChange}
        />
      )}
      {filteredCommits.length === 0 && commits.length > 0 && (
        <span class={s.timelineCommitsEmpty}>
          {commits.length} commits hidden
        </span>
      )}
      {isSupported && !isRecording && commits.length !== 0 && (
        <OutsideClick
          onClick={() => setFilterVisible(false)}
          class={filterBarStyles.filterBtnWrapper}
        >
          <IconBtn
            title='Filter Commits'
            active={filterVisible}
            testId='filter-menu-button'
            onClick={() => setFilterVisible(!filterVisible)}
          >
            <Icon icon='filter-list' />
          </IconBtn>
          {filterVisible && <TimelineFilterPopup />}
        </OutsideClick>
      )}
    </Actions>
  );
}

export function TimelineFilterPopup() {
  const store = useStore();
  const [filterCommitsUnder, setFilterCommitsUnder] = useState(
    store.profiler.filterCommitsUnder.value,
  );

  return (
    <FilterPopup
      className={s.filterPopup}
      onFiltersSubmit={() => {
        store.profiler.filterCommitsUnder.value = filterCommitsUnder
          ? filterCommitsUnder
          : false;
        store.profiler.activeCommitIdx.value =
          (store.profiler.filteredCommits.value ?? [])[0]?.index ?? 0;
      }}
    >
      <FilterNumber
        value={filterCommitsUnder}
        label='Hide commits under'
        units='ms'
        onInput={value => {
          setFilterCommitsUnder(value);
        }}
        defaultValue={0}
      />
    </FilterPopup>
  );
}

export function RecordBtn() {
  const store = useStore();
  const isRecording = store.profiler.isRecording.value;
  const isSupported = store.profiler.isSupported.value;

  const onClick = useCallback(() => {
    const { isRecording, captureRenderReasons } = store.profiler;

    if (!isRecording.value) {
      startProfiling(store.profiler);
      store.emit('start-profiling', {
        captureRenderReasons: captureRenderReasons.value,
      });
    } else {
      stopProfiling(store.profiler);
      store.emit('stop-profiling', null);
    }
  }, [store]);

  return (
    <IconBtn
      title={!isRecording ? 'Start Recording' : 'Stop Recording'}
      color={isSupported
        ? isRecording
          ? 'var(--color-record-active)'
          : 'var(--color-selected-bg)'
        : 'var(--color-disabled)'}
      onClick={onClick}
      disabled={!isSupported}
      testId='record-btn'
    >
      <Icon icon='record-icon' />
    </IconBtn>
  );
}
