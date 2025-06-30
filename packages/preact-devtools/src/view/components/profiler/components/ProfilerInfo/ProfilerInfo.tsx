import { h } from 'preact';
import { useStore } from '../../../../store/react-bindings';
import { RecordBtn } from '../TimelineBar/TimelineBar';

export function ProfilerInfo() {
  const store = useStore();
  const isRecording = store.profiler.isRecording.value;
  const isSupported = store.profiler.isSupported.value;
  const commits = store.profiler.commits.value;

  if (!isSupported) {
    return (
      <div class='profiler-info' data-testid='profiler-info'>
        <p class='profiler-info-title'>Profiling is not supported</p>
        <p class='profiler-info-descr'>
          Please upgrade Preact to a version that supports it (&gt;=10.3.0).
        </p>
      </div>
    );
  } else if (isRecording) {
    return (
      <div class='profiler-info' data-testid='profiler-info'>
        <p class='profiler-info-title'>Profiling in progress...</p>
        <p class='profiler-info-descr'>
          Click the record button{' '}
          <span class='profiler-info-btn'>
            <RecordBtn />
          </span>{' '}
          to stop recording.
        </p>
      </div>
    );
  } else if (commits.length === 0) {
    return (
      <div class='profiler-info' data-testid='profiler-info'>
        <p class='profiler-info-title'>No profiling data collected</p>
        <p class='profiler-info-descr'>
          Click the record button{' '}
          <span class='profiler-info-btn'>
            <RecordBtn />
          </span>{' '}
          to start recording.
        </p>
      </div>
    );
  }

  return null;
}
