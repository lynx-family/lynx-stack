import { h } from 'preact';
import s from '../../Devtools.module.css';
import { ThemeSwitcher } from '../../ThemeSwitcher';
import { TimelineBar } from './TimelineBar/TimelineBar';
import { FlameGraph } from '../flamegraph/FlameGraph';
import { SidebarHeader } from './SidebarHeader';
import { RenderedAt } from './RenderedAt/RenderedAt';
import { ProfilerInfo } from './ProfilerInfo/ProfilerInfo';
import { CommitInfo } from './CommitInfo/CommitInfo';
import { RenderReasons } from './RenderReasons';
import { DebugProfilerInfo } from './CommitInfo/DebugInfo';
import { DebugNodeNav } from './RenderedAt/DebugNodeNav';
import { useStore } from '../../../store/react-bindings';
import { SidebarLayout } from '../../SidebarLayout';
import { Message, MessageBtn } from '../../Message/Message';

export function Profiler() {
  const store = useStore();
  const showDebug = store.debugMode.value;
  const statsRecording = store.stats.isRecording.value;

  return (
    <SidebarLayout>
      <ThemeSwitcher />
      <div class={s.componentActions}>
        <TimelineBar />
      </div>
      <div class={`${s.components} flamegraph-wrapper`}>
        <ProfilerInfo />
        <FlameGraph />
      </div>
      <div class={s.sidebarActions}>
        <SidebarHeader />
      </div>
      <div class={s.sidebar}>
        {statsRecording && (
          <div class='profiler-sidebar-panel'>
            <Message type='info'>
              Stats recording is enabled. Timings may be less accurate.
              <MessageBtn
                onClick={() => {
                  store.stats.isRecording.value = false;
                }}
                testId='disable-stats-recording'
              >
                Disable
              </MessageBtn>
            </Message>
          </div>
        )}
        <RenderReasons />
        <RenderedAt />
        <CommitInfo />
        {showDebug && <DebugProfilerInfo />}
        {showDebug && <DebugNodeNav />}
      </div>
    </SidebarLayout>
  );
}
