# @lynx-js/web-core

Lynx3 Web Platform runtime core - A powerful web components framework with built-in state management, performance monitoring, and error handling.

## Basic Usage

```javascript
import '@lynx-js/web-core';
import '@lynx-js/web-core/index.css';

document.body.innerHTML = `
<lynx-view 
    style="height:100vh; width:100vw;" 
    url="http://localhost:3000/main/main-thread.js"
>
</lynx-view>`;
```

## Advanced Usage Examples

### 1. Creating a Custom View with State Management

```typescript
import { LynxView, Store } from '@lynx-js/web-core';

class CounterView extends LynxView {
  private store = new Store({ count: 0 });

  constructor() {
    super();
    this.store.subscribe(state => this.render(state));
  }

  private render(state: { count: number }) {
    this.innerHTML = `
      <div>Count: ${state.count}</div>
      <button onclick="this.increment()">Increment</button>
    `;
  }

  private increment() {
    const { count } = this.store.getState();
    this.store.setState({ count: count + 1 });
  }
}

customElements.define('counter-view', CounterView);
```

### 2. Using Error Boundaries

```typescript
import { ErrorBoundary } from '@lynx-js/web-core';

// In your HTML
<lynx-error-boundary>
  <my-component></my-component>
</lynx-error-boundary>;

// With custom error handling
const errorBoundary = new ErrorBoundary({
  onError: (error) => console.error('Caught:', error),
  onRetry: () => console.log('Retrying...'),
});
```

### 3. Performance Monitoring

```typescript
import { performanceMonitor } from '@lynx-js/web-core';

class OptimizedView extends LynxView {
  connectedCallback() {
    performanceMonitor.startMeasure('render', 'component');

    // Your render logic

    const metric = performanceMonitor.endMeasure('render', 'component');
    console.log(`Render time: ${metric.duration}ms`);
  }
}
```

### 4. Lifecycle Management

```typescript
import { LifecycleManager } from '@lynx-js/web-core';

class ManagedComponent extends HTMLElement {
  private lifecycle = LifecycleManager.getInstance();

  constructor() {
    super();
    this.lifecycle.registerHook('component-id', {
      phase: 'beforeMount',
      callback: async () => {
        // Setup logic
      },
    });
  }
}
```

### 5. Configuration

```typescript
import { ConfigManager } from '@lynx-js/web-core';

const config = ConfigManager.getInstance();

config.updateConfig({
  debug: true,
  performance: {
    enabled: true,
    sampleRate: 1.0,
  },
  errorHandling: {
    enabled: true,
    reportToServer: true,
    endpoint: '/errors',
  },
});
```

## CSS Customization

The framework provides built-in CSS custom properties for styling:

```css
lynx-view {
  --lynx-view-width: 100%;
  --lynx-view-height: 100%;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  lynx-view {
    color-scheme: dark;
  }
}
```

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 13.1+

## Document

See our website for more information.

## License

Apache License Version 2.0
