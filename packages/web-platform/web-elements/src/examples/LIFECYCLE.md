# Web Elements Lifecycle Implementation

This document outlines the lifecycle implementation approach used in the Web Elements library. This approach follows standard web component practices while providing a more structured and predictable development experience.

## Standard Lifecycle Methods

Web Elements implements all standard lifecycle methods as defined in the Web Components specification:

1. **constructor**: Called when the element is created
2. **connectedCallback**: Called when the element is added to the DOM
3. **disconnectedCallback**: Called when the element is removed from the DOM
4. **attributeChangedCallback**: Called when an observed attribute changes
5. **adoptedCallback**: Called when the element is moved to a new document

## Enhanced Lifecycle Pattern

Our implementation enhances the standard lifecycle with protected hooks that make it easier to build components without worrying about calling `super()`:

| Standard Method          | Protected Hook       | Description                                    |
| ------------------------ | -------------------- | ---------------------------------------------- |
| constructor              | initialize()         | Called once during construction                |
| connectedCallback        | onConnected()        | Called when element is connected to DOM        |
| disconnectedCallback     | onDisconnected()     | Called when element is disconnected from DOM   |
| adoptedCallback          | onAdopted()          | Called when element is moved to a new document |
| attributeChangedCallback | onAttributeChanged() | Called when observed attribute changes         |

This approach provides several benefits:

- Component authors can override the hooks without having to call `super()`
- Base class lifecycle logic always runs, preventing bugs
- Common functionality can be implemented in the base class
- Each lifecycle stage has a clear purpose

## Special Hooks

In addition to the standard lifecycle hooks, Web Elements provides some additional hooks:

- **render()**: Called during connectedCallback to render content to shadow DOM
- **initialize()**: Called once during construction to set up the element

## Shadow DOM Management

The `WebElement` base class manages the shadow DOM configuration automatically:

```typescript
if (constructor.shadowRootMode !== null) {
  this.attachShadow({
    mode: constructor.shadowRootMode || 'open',
    delegatesFocus: constructor.delegatesFocus || false,
  });
}
```

Components can specify their shadow DOM configuration through static properties:

```typescript
class MyElement extends WebElement {
  static shadowRootMode = 'open'; // 'open', 'closed', or null (no shadow DOM)
  static delegatesFocus = true; // Whether to delegate focus
}
```

## Attribute Handling

Web Elements provides enhanced attribute handling:

1. **Observed Attributes**: Defined through the standard `static get observedAttributes()` method
2. **False Attribute Filtering**: Attributes with value 'false' are automatically removed unless specified otherwise
3. **Attribute Change Hooks**: The `onAttributeChanged` hook makes it easy to respond to changes

Example:

```typescript
class MyElement extends WebElement {
  static get observedAttributes() {
    return ['color', 'size'];
  }
  static notToFilterFalseAttributes = new Set(['disabled']);

  onAttributeChanged(name, oldValue, newValue) {
    if (name === 'color') {
      this.style.color = newValue;
    }
  }
}
```

## Plugin Architecture

The `EnhancedComponent` decorator allows components to use plugins that hook into the lifecycle:

```typescript
@EnhancedComponent('my-button', {
  plugins: [RippleEffect],
})
class MyButton extends WebElement {
  // Component implementation
}
```

Plugins can implement any of the lifecycle methods, which will be called at the appropriate times:

```typescript
class RippleEffect {
  static get observedAttributes() {
    return ['ripple-color'];
  }

  constructor(element) {
    this.element = element;
    // Initialize plugin
  }

  connectedCallback() {
    // Called when element is connected
  }

  disconnectedCallback() {
    // Called when element is disconnected
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // Handle attribute changes
  }
}
```

## Lifecycle Diagram

```
┌─────────────────────────┐
│      Construction       │
│  ┌───────────────────┐  │
│  │    constructor    │  │
│  └────────┬──────────┘  │
│           │             │
│  ┌────────▼──────────┐  │
│  │    initialize()   │  │
│  └───────────────────┘  │
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│    DOM Connection       │
│  ┌───────────────────┐  │
│  │ connectedCallback │  │
│  └────────┬──────────┘  │
│           │             │
│  ┌────────▼──────────┐  │
│  │     render()      │  │
│  └────────┬──────────┘  │
│           │             │
│  ┌────────▼──────────┐  │
│  │   onConnected()   │  │
│  └───────────────────┘  │
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│   During Lifecycle      │
│  ┌───────────────────┐  │
│  │attributeChangedCB │  │
│  └────────┬──────────┘  │
│           │             │
│  ┌────────▼──────────┐  │
│  │onAttributeChanged │  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │  adoptedCallback  │  │
│  └────────┬──────────┘  │
│           │             │
│  ┌────────▼──────────┐  │
│  │    onAdopted()    │  │
│  └───────────────────┘  │
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│  DOM Disconnection      │
│  ┌───────────────────┐  │
│  │disconnectedCallbk │  │
│  └────────┬──────────┘  │
│           │             │
│  ┌────────▼──────────┐  │
│  │ onDisconnected()  │  │
│  └───────────────────┘  │
└─────────────────────────┘
```

## Best Practices

When implementing components using this lifecycle:

1. Use the protected hooks rather than overriding the standard methods
2. Put one-time initialization code in `initialize()`
3. Put rendering logic in `render()`
4. Add event listeners in `onConnected()` and remove them in `onDisconnected()`
5. Handle attribute changes in `onAttributeChanged()`
6. Use plugins to share behavior across components
7. Use the `EnhancedComponent` decorator to simplify component definition
