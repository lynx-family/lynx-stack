/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

import { WebElement } from '../common/WebElement.js';
import {
  EnhancedComponent,
  css,
  html as enhancedHtml,
} from '../common/enhancedComponent.js';

/**
 * Plugin that adds ripple effect to buttons
 */
class RippleEffect {
  element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
    this.setupRipple();
  }

  static get observedAttributes() {
    return ['ripple-color'];
  }

  setupRipple() {
    this.element.addEventListener('click', this.createRipple.bind(this));
  }

  createRipple(event: MouseEvent) {
    const button = this.element;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();

    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.classList.add('ripple');

    // Use ripple color attribute if available
    const rippleColor = button.getAttribute('ripple-color')
      || 'rgba(255, 255, 255, 0.7)';
    ripple.style.backgroundColor = rippleColor;

    // Find ripple container in shadow DOM
    const shadowRoot = button.shadowRoot;
    if (shadowRoot) {
      const rippleContainer = shadowRoot.querySelector('.ripple-container');
      if (rippleContainer) {
        rippleContainer.appendChild(ripple);

        // Remove ripple after animation
        setTimeout(() => {
          ripple.remove();
        }, 600);
      }
    }
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ) {
    // Handle ripple color change
    if (name === 'ripple-color' && oldValue !== newValue) {
      console.log(`Ripple color changed from ${oldValue} to ${newValue}`);
    }
  }

  disconnectedCallback() {
    // Clean up event listeners
    this.element.removeEventListener('click', this.createRipple.bind(this));
  }
}

/**
 * Example button with proper lifecycle methods and enhanced features
 */
@EnhancedComponent('example-button', {
  template: enhancedHtml`
    <button part="button">
      <slot></slot>
      <div class="ripple-container"></div>
    </button>
  `,
  styles: css`
    :host {
      display: inline-block;
      position: relative;
      overflow: hidden;
    }
    
    button {
      background: var(--button-bg, #3498db);
      color: var(--button-color, white);
      border: none;
      border-radius: 4px;
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: background-color 0.3s, box-shadow 0.3s;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
    
    button:hover {
      background: var(--button-hover-bg, #2980b9);
    }
    
    button:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.3);
    }
    
    .ripple-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      pointer-events: none;
    }
    
    .ripple {
      position: absolute;
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 0.6s linear;
      pointer-events: none;
    }
    
    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
    
    :host([disabled]) button {
      background: var(--button-disabled-bg, #cccccc);
      color: var(--button-disabled-color, #888888);
      cursor: not-allowed;
    }
  `,
  plugins: [RippleEffect],
  delegatesFocus: true,
})
export class ExampleButton extends WebElement {
  // Observe these attributes for changes
  static override get observedAttributes(): never[] {
    return [] as never[];
  }

  // Attributes with value 'false' shouldn't be filtered out
  static override readonly notToFilterFalseAttributes = new Set(['disabled']);

  // Custom properties
  #clickCount = 0;

  /**
   * Initialize element
   */
  protected override initialize(): void {
    // Set initial state
    this.#updateButtonStyle();

    // Add click listener
    this.addEventListener('click', this.#handleClick);

    console.log('ExampleButton initialized');
  }

  /**
   * Handle click events
   */
  #handleClick = (event: Event) => {
    if (this.disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Increment click counter
    this.#clickCount++;

    // Dispatch custom event
    this.dispatchEvent(
      new CustomEvent('button-clicked', {
        bubbles: true,
        composed: true,
        detail: {
          count: this.#clickCount,
        },
      }),
    );
  };

  /**
   * Update button appearance based on attributes
   */
  #updateButtonStyle(): void {
    // Apply color
    const color = this.getAttribute('color') || 'default';
    this.style.setProperty('--button-bg', this.#getColorValue(color));
    this.style.setProperty(
      '--button-hover-bg',
      this.#getHoverColorValue(color),
    );

    // Apply size
    const size = this.getAttribute('size') || 'medium';
    this.#applySize(size);
  }

  /**
   * Get CSS color value based on color name
   */
  #getColorValue(color: string): string {
    switch (color) {
      case 'primary':
        return '#3498db';
      case 'success':
        return '#2ecc71';
      case 'danger':
        return '#e74c3c';
      case 'warning':
        return '#f39c12';
      default:
        return '#3498db';
    }
  }

  /**
   * Get hover color value
   */
  #getHoverColorValue(color: string): string {
    switch (color) {
      case 'primary':
        return '#2980b9';
      case 'success':
        return '#27ae60';
      case 'danger':
        return '#c0392b';
      case 'warning':
        return '#d35400';
      default:
        return '#2980b9';
    }
  }

  /**
   * Apply size to button
   */
  #applySize(size: string): void {
    const button = this.shadowRoot?.querySelector('button');
    if (!button) return;

    switch (size) {
      case 'small':
        button.style.padding = '6px 12px';
        button.style.fontSize = '14px';
        break;
      case 'large':
        button.style.padding = '12px 24px';
        button.style.fontSize = '18px';
        break;
      case 'medium':
      default:
        button.style.padding = '10px 20px';
        button.style.fontSize = '16px';
        break;
    }
  }

  /**
   * Called when the element is connected to the DOM
   */
  protected override onConnected(): void {
    console.log('ExampleButton connected to DOM');
  }

  /**
   * Called when the element is disconnected from the DOM
   */
  protected override onDisconnected(): void {
    // Clean up resources
    this.removeEventListener('click', this.#handleClick);
    console.log('ExampleButton disconnected from DOM');
  }

  /**
   * Handle attribute changes
   */
  protected override onAttributeChanged(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    console.log(`Attribute ${name} changed from ${oldValue} to ${newValue}`);

    // Update styles based on attribute changes
    if (['color', 'size'].includes(name)) {
      this.#updateButtonStyle();
    }
  }

  /**
   * Getter/setter for disabled property
   */
  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }

  set disabled(value: boolean) {
    if (value) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }

  /**
   * Getter/setter for color property
   */
  get color(): string {
    return this.getAttribute('color') || 'default';
  }

  set color(value: string) {
    this.setAttribute('color', value);
  }

  /**
   * Getter/setter for size property
   */
  get size(): string {
    return this.getAttribute('size') || 'medium';
  }

  set size(value: string) {
    this.setAttribute('size', value);
  }
}
