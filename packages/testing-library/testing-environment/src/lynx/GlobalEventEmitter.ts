export class GlobalEventEmitter {
  listeners: Record<string, Function[]> = {};
  addListener(eventName: string, listener: Function): void {
    this.listeners[eventName] ??= [];
    this.listeners[eventName].push(listener);
  }
  removeListener(eventName: string, listener: Function): void {
    if (!this.listeners[eventName]) {
      return;
    }
    this.listeners[eventName] = this.listeners[eventName].filter((l) =>
      l !== listener
    );
  }
  emit(eventName: string, args: any[]): void {
    if (!this.listeners[eventName]) {
      return;
    }
    this.listeners[eventName].forEach((listener) =>
      args ? listener(...args) : listener()
    );
  }
  clear(): void {
    this.listeners = {};
  }
  removeAllListeners(eventName?: string): void {
    if (eventName) {
      delete this.listeners[eventName];
    } else {
      this.clear();
    }
  }
  trigger(eventName: string, params: string | Record<any, any>): void {
    this.emit(eventName, [params]);
  }
  toggle(eventName: string, ...data: unknown[]): void {
    this.emit(eventName, data);
  }
}
