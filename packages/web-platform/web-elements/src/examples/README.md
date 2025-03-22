# Web Elements Lifecycle Examples

This directory contains examples demonstrating the improved Web Elements lifecycle implementation using standard custom element lifecycle methods.

## Overview

The examples in this directory showcase a new approach to implementing web components in the Lynx stack with proper lifecycle methods and enhanced features:

- `WebElement.ts`: A base class for all web elements that implements standard custom element lifecycle methods
- `enhancedComponent.ts`: An enhanced Component decorator that works with the WebElement base class
- `ExampleButton.ts`: A practical example component using the WebElement base class
- `example-usage.html`: A demonstration page showing the component in action
- `standalone-test.html`: A self-contained test page that works without external dependencies

## Key Features

The new implementation offers several advantages over the previous approach:

1. **Standard Lifecycle Methods**: Properly implements all standard custom element lifecycle methods (`connectedCallback`, `disconnectedCallback`, `attributeChangedCallback`, `adoptedCallback`)
2. **Type Safety**: Fully typed interface with proper TypeScript typing
3. **Shadow DOM Support**: Built-in shadow DOM configuration with customizable mode and focus delegation
4. **Plugin Architecture**: Support for plugins that can hook into lifecycle methods
5. **Attribute Observation**: Streamlined attribute handling with observed attributes
6. **Enhanced Component Decorator**: A powerful decorator to define elements with templates, styles, and plugins

## Running the Examples

To run the examples, follow these steps:

### Using the Main Example

1. Install dependencies (if not already done):
   ```
   pnpm install
   ```

2. Run the example server:
   ```
   pnpm run serve-example
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000/example-usage.html
   ```

### Using the Standalone Test

If you encounter dependency issues with the main example, you can use the standalone test page which doesn't require any external dependencies:

1. Run the standalone test server:
   ```
   pnpm run test-standalone
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:8080/
   ```

The standalone test provides the exact same functionality as the main example but with all necessary code inline.

## Example Component: ExampleButton

The `ExampleButton` component demonstrates:

- Property reflection to attributes
- Lifecycle method hooks
- Event handling
- Dynamic styling based on attributes
- Custom event dispatching
- Plugin integration (ripple effect)

You can interact with the component properties using the control panel on the example page.

## Implementation Details

### WebElement Base Class

The `WebElement` base class provides:

- A consistent interface for lifecycle methods
- Protected hooks that subclasses can override
- Automatic shadow DOM initialization
- Attribute change detection and handling
- Proper false attribute filtering

### EnhancedComponent Decorator

The decorator provides:

- Easy registration of custom elements
- Template and style integration
- Plugin system for enhancing elements with additional functionality
- Attribute observation configuration
- Support for mixins to compose behaviors

## Testing Lifecycle Methods

The examples include tools for testing all standard lifecycle methods:

1. **Constructor**: Called when the element is created
2. **connectedCallback**: Called when the element is added to the DOM
3. **disconnectedCallback**: Called when the element is removed from the DOM
4. **attributeChangedCallback**: Called when an observed attribute changes
5. **adoptedCallback**: Called when the element is moved to a new document

You can test these events using the lifecycle testing controls on the example pages.

## Migration Path

To migrate existing components to use this new approach:

1. Extend the `WebElement` class instead of `HTMLElement`
2. Replace the existing `@Component` decorator with `@EnhancedComponent`
3. Override the appropriate lifecycle hooks (`initialize`, `onConnected`, `onDisconnected`, `onAttributeChanged`)
4. Move shadow DOM template and styles to the decorator configuration

## Benefits

This implementation offers several benefits:

- Better adherence to web standards
- More predictable lifecycle behavior
- Improved type safety
- Better separation of concerns
- Enhanced maintainability
- Support for plugins and mixins
