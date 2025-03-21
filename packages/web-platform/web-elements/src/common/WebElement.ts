/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

/**
 * WebElement - Base class for all web elements
 *
 * This class provides a consistent foundation for implementing web components
 * with proper lifecycle methods according to the Web Components specification.
 * It offers several enhancements:
 *
 * 1. Standard lifecycle methods (connectedCallback, disconnectedCallback, etc.)
 * 2. Protected hooks that subclasses can override without having to call super()
 * 3. Automatic shadow DOM initialization
 * 4. Attribute change detection and handling
 * 5. Proper handling of boolean attributes with false values
 *
 * @example
 * ```ts
 * class MyElement extends WebElement {
 *   static get observedAttributes() { return ['color', 'size']; }
 *
 *   initialize() {
 *     // Called during construction
 *   }
 *
 *   onConnected() {
 *     // Called when element is added to DOM
 *   }
 *
 *   onDisconnected() {
 *     // Called when element is removed from DOM
 *   }
 *
 *   onAttributeChanged(name, oldValue, newValue) {
 *     // Called when observed attribute changes
 *   }
 * }
 * ```
 */
export class WebElement extends HTMLElement {
  /**
   * Shadow root mode configuration for the element
   * Override this in subclasses to change the shadow DOM mode
   */
  protected static readonly shadowRootMode: ShadowRootMode | null = 'open';

  /**
   * Whether the shadow root should delegate focus
   * Override this in subclasses to change focus delegation behavior
   */
  protected static readonly delegatesFocus: boolean = false;

  /**
   * Attributes that should be observed for changes.
   * Override this in subclasses to specify which attributes to observe.
   */
  static get observedAttributes() {
    return [];
  }

  /**
   * Set of attributes that should not be filtered when their value is 'false'.
   * By default, attributes with value 'false' are removed to maintain standard
   * boolean attribute behavior, but some attributes need to keep the literal 'false' value.
   */
  static readonly notToFilterFalseAttributes: Set<string> = new Set();

  /**
   * Store for element initialization state
   */
  #initialized = false;

  /**
   * Manually track connection state
   */
  #connected = false;

  /**
   * Read-only property indicating whether the element is currently connected to the DOM.
   */
  protected get elementIsConnected(): boolean {
    return this.#connected;
  }

  /**
   * Constructor for WebElement.
   * Sets up shadow DOM if configured, initializes the element,
   * and cleans up any 'false' attributes.
   */
  constructor() {
    super();

    const constructor = this.constructor as typeof WebElement;

    // Create shadow DOM if enabled
    if (constructor.shadowRootMode !== null) {
      this.attachShadow({
        mode: constructor.shadowRootMode || 'open',
        delegatesFocus: constructor.delegatesFocus || false,
      });
    }

    if (!this.#initialized) {
      this.initialize();
      this.#initialized = true;
    }

    this.#cleanFalseAttributes();
  }

  /**
   * Protected initialization hook.
   * Override this in subclasses to perform one-time setup during construction.
   * This is called only once per instance.
   */
  protected initialize(): void {
    // Override in subclasses
  }

  /**
   * Protected render hook.
   * Override this in subclasses to render content to the shadow DOM.
   * This is called during connectedCallback.
   */
  protected render(): void {
    // Override in subclasses
  }

  /**
   * Standard custom element lifecycle method.
   * Called when the element is added to the DOM.
   * Calls render() and then onConnected().
   */
  connectedCallback(): void {
    this.#connected = true;

    // Render content
    this.render();

    // Call connected lifecycle hook for subclasses
    this.onConnected();
  }

  /**
   * Protected connected hook.
   * Override this in subclasses to perform actions when the element is added to the DOM.
   */
  protected onConnected(): void {
    // Override in subclasses
  }

  /**
   * Standard custom element lifecycle method.
   * Called when the element is removed from the DOM.
   * Calls onDisconnected().
   */
  disconnectedCallback(): void {
    this.#connected = false;

    // Call disconnected lifecycle hook for subclasses
    this.onDisconnected();
  }

  /**
   * Protected disconnected hook.
   * Override this in subclasses to perform cleanup when the element is removed from the DOM.
   */
  protected onDisconnected(): void {
    // Override in subclasses
  }

  /**
   * Standard custom element lifecycle method.
   * Called when the element is moved to a new document.
   * Calls onAdopted().
   */
  adoptedCallback(): void {
    this.onAdopted();
  }

  /**
   * Protected adopted hook.
   * Override this in subclasses to perform actions when the element is moved to a new document.
   */
  protected onAdopted(): void {
    // Override in subclasses
  }

  /**
   * Standard custom element lifecycle method.
   * Called when an observed attribute changes.
   * Handles filtering of 'false' attributes and calls onAttributeChanged().
   *
   * @param name - The name of the attribute that changed
   * @param oldValue - The previous value of the attribute
   * @param newValue - The new value of the attribute
   */
  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    const constructor = this.constructor as typeof WebElement;

    // Handle false attribute filtering
    if (
      !constructor.notToFilterFalseAttributes.has(name)
      && !name.startsWith('data-')
    ) {
      if (oldValue === 'false') oldValue = null;
      if (newValue === 'false') {
        newValue = null;
        this.removeAttribute(name);
      }
    }

    // Skip if no change
    if (oldValue === newValue) return;

    // Call attribute changed hook for subclasses
    this.onAttributeChanged(name, oldValue, newValue);
  }

  /**
   * Protected attribute changed hook.
   * Override this in subclasses to perform actions when an observed attribute changes.
   *
   * @param name - The name of the attribute that changed
   * @param oldValue - The previous value of the attribute
   * @param newValue - The new value of the attribute
   */
  protected onAttributeChanged(
    _name: string,
    _oldValue: string | null,
    _newValue: string | null,
  ): void {
    // Override in subclasses
  }

  /**
   * Override of the standard setAttribute method.
   * Filters out attribute values of 'false' by default, removing the attribute instead.
   *
   * @param qualifiedName - The name of the attribute to set
   * @param value - The value to set
   */
  override setAttribute(qualifiedName: string, value: string): void {
    const constructor = this.constructor as typeof WebElement;

    // Remove attribute if value is 'false' and not in exceptions list
    if (
      value === 'false'
      && !constructor.notToFilterFalseAttributes.has(qualifiedName)
      && !qualifiedName.startsWith('data-')
    ) {
      this.removeAttribute(qualifiedName);
      return;
    }

    super.setAttribute(qualifiedName, value);
  }

  /**
   * Cleans up any attributes with the value 'false'.
   * Called during construction.
   * @private
   */
  #cleanFalseAttributes(): void {
    const constructor = this.constructor as typeof WebElement;
    const attributes = this.attributes;

    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];

      if (
        attr
        && attr.value === 'false'
        && !constructor.notToFilterFalseAttributes.has(attr.name)
        && !attr.name.startsWith('data-')
      ) {
        this.removeAttributeNode(attr);
        i--; // Adjust index since we removed an attribute
      }
    }
  }
}
