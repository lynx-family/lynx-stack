import { LifecycleConstant } from '../../lifecycleConstant.js';

const delayedLifecycleEvents: [type: string, data: any][] = [];

function delayLifecycleEvent(type: string, data: any): void {
  // We need to ensure that firstScreen events are executed before other events.
  // This is because firstScreen events are used to initialize the dom tree,
  // and other events depend on the dom tree being fully constructed.
  // There might be some edge cases where ctx cannot be found in `ref` lifecycle event,
  // and they should be ignored safely.
  if (type === LifecycleConstant.firstScreen) {
    delayedLifecycleEvents.unshift([type, data]);
  } else {
    delayedLifecycleEvents.push([type, data]);
  }
}

/**
 * @internal
 */
export { delayLifecycleEvent, delayedLifecycleEvents };
