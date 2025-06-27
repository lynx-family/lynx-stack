import { h, Fragment } from 'preact';
import { useStore } from '../../store/react-bindings';
import { PropsPanel } from './inspect/PropsPanel';
import { serializeProps } from './inspect/serializeProps';
import { DebugTreeStats } from './DebugTreeStats';
import { DebugNodeNavTree } from './DebugNodeNavTree';
import { OwnerInfo } from './../elements/OwnerInfo';
import { KeyPanel } from './KeyPanel';
import { HocPanel } from './HocPanel';
import { useComputed } from '@preact/signals';

export function Sidebar() {
  const store = useStore();
  const showDebug = store.debugMode.value;
  const inspect = store.inspectData.value;
  const hocs = useComputed(() => {
    if (store.inspectData.value) {
      const node = store.nodes.value.get(store.inspectData.value.id);
      return node ? node.hocs : null;
    }
    return null;
  }).value;
  const { props: propData, state, context, hooks, signals } = store.sidebar;
  const { emit } = store;

  return (
    <Fragment>
      {inspect && inspect.key !== null && (
        <KeyPanel
          value={inspect.key}
          onCopy={() => emit('copy', inspect.key!)}
        />
      )}
      {inspect && hocs !== null && hocs.length > 0 && <HocPanel hocs={hocs} />}
      <PropsPanel
        label='Props'
        items={propData.items}
        uncollapsed={propData.uncollapsed}
        onChange={(value, path) =>
          emit('update-prop', { id: inspect!.id, path, value })}
        onCopy={() => inspect && emit('copy', serializeProps(inspect.props))}
        canAddNew
      />
      {inspect && inspect.signals !== null && (
        <PropsPanel
          label='Signals'
          items={signals.items}
          uncollapsed={signals.uncollapsed}
          onChange={(value, path) => {
            emit('update-signal', {
              id: inspect!.id,
              path,
              value,
            });
          }}
        />
      )}
      {inspect && inspect.hooks !== null && (
        <PropsPanel
          label='Hooks'
          items={hooks.items}
          uncollapsed={hooks.uncollapsed}
          onChange={(value, path, node) => {
            emit('update-hook', {
              id: inspect!.id,
              value,
              meta: node != null ? node.meta : null,
            });
          }}
          onCopy={() => inspect && emit('copy', serializeProps(inspect.hooks))}
        />
      )}
      {inspect && inspect.state !== null && (
        <PropsPanel
          label='State'
          items={state.items}
          uncollapsed={state.uncollapsed}
          onChange={(value, path) =>
            emit('update-state', { id: inspect!.id, path, value })}
          onCopy={() => inspect && emit('copy', serializeProps(inspect.state))}
        />
      )}
      {inspect && inspect.context !== null && (
        <PropsPanel
          label='Context'
          items={context.items}
          uncollapsed={context.uncollapsed}
          onChange={(value, path) =>
            emit('update-context', { id: inspect!.id, path, value })}
          onCopy={() =>
            inspect && emit('copy', serializeProps(inspect.context))}
        />
      )}
      {inspect && <OwnerInfo />}
      {showDebug && <DebugTreeStats />}
      {showDebug && <DebugNodeNavTree />}
    </Fragment>
  );
}
