import {
  createReason,
  getChangedKeys,
  RenderReason,
  RenderReasonData,
} from '../shared/renderReasons';
import { VNodeTimings } from '../shared/timings';
import {
  getComponent,
  getStatefulHooks,
  getStatefulHookValue,
  getVNodeParent,
  Internal,
  isComponent,
  isUseReducerOrState,
} from './bindings';

export interface RenderReasonTmpData {
  type: any;
  props: any;
}

/**
 * Detect why a VNode updated.
 */
export function getRenderReasonPre(
  timings: VNodeTimings<Internal>,
  internal: Internal,
  oldData: RenderReasonTmpData,
): RenderReasonData | null {
  // Components
  if (isComponent(internal) && internal.type === oldData.type) {
    const c = getComponent(internal);
    if (c !== null) {
      // Check hooks
      const hooks = getStatefulHooks(internal);

      if (hooks !== null) {
        for (let i = 0; i < hooks.length; i++) {
          if (
            isUseReducerOrState(hooks[i])
            && hooks[i]._oldValue !== getStatefulHookValue(hooks[i])
          ) {
            return createReason(RenderReason.HOOKS_CHANGED, null);
          }
        }
      }

      // Check state
      const prevState = (c as any)._prevState;
      if (prevState != null && prevState !== c.state) {
        return createReason(
          RenderReason.STATE_CHANGED,
          getChangedKeys(prevState, c.state),
        );
      } else if (
        prevState === undefined
        && c.state !== undefined
        && Object.keys(c.state).length > 0
      ) {
        return createReason(RenderReason.STATE_CHANGED, null);
      }
    }
  }

  // Check props
  if (internal.props !== oldData.props) {
    const propsChanged = getChangedKeys(internal.props, oldData.props);
    if (propsChanged.length > 0) {
      return createReason(RenderReason.PROPS_CHANGED, propsChanged);
    }
  }

  const parent = getVNodeParent(internal);
  if (parent != null) {
    if (
      parent != null
      && (timings.start.get(internal) || 0) >= (timings.start.get(parent) || 0)
      && (timings.end.get(internal) || 0) <= (timings.end.get(parent) || 0)
    ) {
      return createReason(RenderReason.PARENT_UPDATE, null);
    }
  }

  return createReason(RenderReason.FORCE_UPDATE, null);
}
