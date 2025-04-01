let delayedEvents: [handlerName: string, data: unknown][] | undefined;

function delayedPublishEvent(handlerName: string, data: unknown): void {
  delayedEvents ??= [];
  delayedEvents.push([handlerName, data]);
}

export { delayedPublishEvent, delayedEvents };
