export type Subscriber<T> = (state: T) => void;

export interface StoreOptions {
  debugMode?: boolean;
  persistKey?: string;
}

export class Store<T extends Record<string, any>> {
  private state: T;
  private subscribers: Set<Subscriber<T>>;
  private options: StoreOptions;

  constructor(initialState: T, options: StoreOptions = {}) {
    this.subscribers = new Set();
    this.options = options;

    // Load persisted state if available
    const persistedState = this.loadPersistedState();
    this.state = new Proxy(
      persistedState || initialState,
      {
        set: (target, property: string, value) => {
          (target as any)[property] = value;
          this.notifySubscribers();
          this.persistState();
          return true;
        },
        get: (target, property: string) => {
          return target[property];
        },
      },
    );
  }

  getState(): T {
    return { ...this.state };
  }

  setState(partial: Partial<T>): void {
    Object.assign(this.state, partial);
    this.notifySubscribers();
  }

  subscribe(subscriber: Subscriber<T>): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(subscriber => subscriber(this.getState()));
    if (this.options.debugMode) {
      console.log('State updated:', this.getState());
    }
  }

  private persistState(): void {
    if (this.options.persistKey) {
      localStorage.setItem(
        this.options.persistKey,
        JSON.stringify(this.state),
      );
    }
  }

  private loadPersistedState(): T | null {
    if (this.options.persistKey) {
      const saved = localStorage.getItem(this.options.persistKey);
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  }
}
