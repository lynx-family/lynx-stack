import { h, Fragment } from 'preact';
import { Actions } from '../../Actions';
import { useStore, useEmitter } from '../../../store/react-bindings';
import { ComponentName } from '../../ComponentName';
import { useCallback } from 'preact/hooks';
import { IconBtn } from '../../IconBtn';
import { DevNodeType } from '../../../store/types';
import { Icon } from '../../icons';

export function SidebarHeader() {
  const store = useStore();
  const selected = store.profiler.selectedNode.value;
  const emit = useEmitter();
  const log = useCallback(() => {
    if (selected) emit('log', { id: selected.id, children: selected.children });
  }, [selected]);
  const inspectHostNode = useCallback(() => {
    emit('inspect-host-node', null);
  }, []);
  const viewSource = useCallback(() => {
    if (selected) {
      emit('view-source', selected.id);
    }
  }, [selected]);

  const canViewSource = selected
    && selected.type !== DevNodeType.Group
    && selected.type !== DevNodeType.Element;

  return (
    <Actions class='sidebar-actions'>
      <ComponentName>{selected && selected.name}</ComponentName>
      <div class='sidebar-icon-actions'>
        {selected && (
          <Fragment>
            <IconBtn
              title='Show matching DOM element'
              onClick={inspectHostNode}
            >
              <Icon icon='inspect' />
            </IconBtn>
            <IconBtn title='Log internal vnode' onClick={log}>
              <Icon icon='bug' />
            </IconBtn>
            <IconBtn
              title='View Component Source'
              onClick={viewSource}
              disabled={!canViewSource}
            >
              <Icon icon='code-icon' />
            </IconBtn>
          </Fragment>
        )}
      </div>
    </Actions>
  );
}
