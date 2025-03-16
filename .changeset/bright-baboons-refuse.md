---
"@lynx-js/web-core": major
---

Core Components and perfomance monitoring in web platform

# Changelog

### Added Core Systems 🚀

#### Performance Monitoring System

- ✨ Added `PerformanceMonitor` singleton class
- 📊 Implemented performance metrics tracking
- ⏱️ Added start/end measure capabilities
- 📈 Added metrics storage and retrieval

#### Error Boundary System

- 🛡️ Added `ErrorBoundary` custom element
- 🎯 Implemented error catching and fallback rendering
- 🔄 Added retry mechanism
- 🎨 Added customizable error templates

#### State Management System

- 📦 Added `Store` class with TypeScript support
- 🔄 Implemented reactive state updates
- 💾 Added local storage persistence
- 🎯 Added subscription system

#### Lifecycle Management

- 🔄 Added `LifecycleManager` singleton
- 📡 Implemented lifecycle hooks system
- ⏰ Added timeout handling
- 🎯 Added phase-based execution

#### Configuration System

- ⚙️ Added `ConfigManager` singleton
- 🔧 Implemented environment-aware settings
- 💾 Added config persistence
- 🎯 Added type-safe config updates

### CSS Improvements 🎨

- 📏 Added logical properties support
- 🌓 Added dark mode support
- 📱 Improved responsive layouts
- 🎯 Added CSS custom properties
- ♿ Added accessibility improvements

```css
lynx-view {
  --lynx-view-width: 100%;
  --lynx-view-height: 100%;
  contain: strict;
  display: flex;
}
```

### Performance Optimizations ⚡

- 🚀 Added content containment
- 📦 Improved component isolation
- 🎯 Added performance monitoring
- 💾 Added caching mechanisms

### Browser Support 🌐

Added support for:

- Chrome/Edge 80+
- Firefox 75+
- Safari 13.1+

### Breaking Changes ⚠️

- 🔧 Changed lifecycle hook signatures
- 📦 Updated state management API
- 🎯 Modified error boundary interface

### Migration Guide 🔄

To upgrade from 0.8.x to 0.9.0:

1. Update State Management:

```typescript
// Old
const store = new Store(initialState);

// New
const store = new Store(initialState, {
  debugMode: true,
  persistKey: 'my-store',
});
```

2. Update Error Boundaries:

```typescript
// Old
<error-boundary>
  <my-component />
</error-boundary>

// New
<lynx-error-boundary
  fallback-component="custom-error"
  on-error="handleError"
>
  <my-component />
</lynx-error-boundary>
```

3. Update Lifecycle Hooks:

```typescript
// Old
lifecycle.addHook('mount', callback);

// New
lifecycle.registerHook('component-id', {
  phase: 'beforeMount',
  callback: async () => {
    // Hook logic
  },
});
```
