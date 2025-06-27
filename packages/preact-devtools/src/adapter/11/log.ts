import { ID } from '../../view/store/types';
import { RendererConfig } from '../shared/renderer';
import { getVNodeById, IdMappingState } from '../shared/idMapper';
import { getComponent, getDisplayName, Internal } from './bindings';

export function logInternal(
  ids: IdMappingState<Internal>,
  config: RendererConfig,
  id: ID,
  children: ID[],
) {
  const internal = getVNodeById(ids, id);
  if (internal == null) {
    // eslint-disable-next-line no-console
    console.warn(`Could not find internal with id ${id}`);
    return;
  }
  const display = getDisplayName(internal, config);
  const name = display === '#text' ? display : `<${display || 'Component'} />`;

  /* eslint-disable no-console */
  console.group(`LOG %c${name}`, 'color: #ea88fd; font-weight: normal');
  console.log('props:', internal.props);
  const c = getComponent(internal);
  if (c != null) {
    console.log('state:', c.state);
  }
  console.log('internal:', internal);
  console.log('vnodeId:', internal._vnodeId ?? internal.__v);
  console.log('devtools id:', id);
  console.log('devtools children:', children);
  console.groupEnd();
  /* eslint-enable no-console */
}
