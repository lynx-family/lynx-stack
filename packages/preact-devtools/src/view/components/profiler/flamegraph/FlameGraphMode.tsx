import { h, Fragment } from 'preact';
import { IconTab } from '../components/Tabs/Tabs';
import { useStore } from '../../../store/react-bindings';
import { useCallback } from 'preact/hooks';
import { FlamegraphType, getCommitInitialSelectNodeId } from '../data/commits';
import { Icon } from '../../icons';

export function FlameGraphMode() {
  const store = useStore();
  const type = store.profiler.flamegraphType.value;
  const disabled = !store.profiler.isSupported.value;

  const onClick = useCallback((value: string) => {
    const profiler = store.profiler;
    profiler.flamegraphType.value = value as any;
    profiler.selectedNodeId.value = profiler.activeCommit.value
      ? getCommitInitialSelectNodeId(
        profiler.activeCommit.value,
        profiler.flamegraphType.value,
      )
      : -1;
  }, []);

  return (
    <Fragment>
      <IconTab
        name='flamegraph_mode'
        icon={<Icon icon='fire-icon' />}
        value={FlamegraphType.FLAMEGRAPH}
        checked={type === FlamegraphType.FLAMEGRAPH}
        onClick={onClick}
        disabled={disabled}
      >
        Flamegraph
      </IconTab>
      <IconTab
        name='flamegraph_mode'
        icon={<Icon icon='sort-icon' />}
        value={FlamegraphType.RANKED}
        checked={type === FlamegraphType.RANKED}
        onClick={onClick}
        disabled={disabled}
      >
        Ranked
      </IconTab>
    </Fragment>
  );
}
