import {
  LynxView,
  Store,
  PerformanceMonitor,
  ErrorBoundary,
  ConfigManager,
} from '@lynx-js/web-core';

class CustomLynxView extends LynxView {
  private store: Store<{ count: number }>;
  private monitor = PerformanceMonitor.getInstance();
  private config = ConfigManager.getInstance();

  constructor() {
    super();

    // Initialize store
    this.store = new Store({ count: 0 }, {
      debugMode: this.config.getConfig().debug,
      persistKey: 'custom-view-state',
    });

    // Setup error boundary
    this.attachErrorBoundary();
  }

  private attachErrorBoundary() {
    const errorBoundary = new ErrorBoundary({
      onError: (error) => console.error('View Error:', error),
      onRetry: () => this.render(),
    });
    this.appendChild(errorBoundary);
  }

  protected async render() {
    this.monitor.startMeasure('render', 'component');

    try {
      // Get state
      const { count } = this.store.getState();

      // Render content
      this.innerHTML = `
        <div>Count: ${count}</div>
        <button id="increment">Increment</button>
      `;

      // Add event listeners
      this.querySelector('#increment')?.addEventListener('click', () => {
        this.store.setState({ count: count + 1 });
      });
    } catch (error) {
      if (error instanceof Error) {
        const errorBoundary = this.querySelector('lynx-error-boundary');
        if (errorBoundary instanceof ErrorBoundary) {
          errorBoundary.handleError(error);
        }
      }
    }

    this.monitor.endMeasure('render', 'component');
  }
}

customElements.define('custom-lynx-view', CustomLynxView);
