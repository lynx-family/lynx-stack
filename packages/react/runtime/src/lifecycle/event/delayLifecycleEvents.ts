const delayedLifecycleEvents: [type: string, data: any][] = [];

function delayLifecycleEvent(type: string, data: any): void {
  delayedLifecycleEvents.push([type, data]);
}

/**
 * @internal
 */
export { delayLifecycleEvent, delayedLifecycleEvents };
