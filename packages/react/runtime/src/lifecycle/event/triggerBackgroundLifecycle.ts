/**
 * @internal
 */
function triggerBackgroundLifecycle(name: string, data: any): void {
  __OnLifecycleEvent([name, data]);
}

export { triggerBackgroundLifecycle };
