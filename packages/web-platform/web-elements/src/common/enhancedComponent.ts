/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

import { WebElement } from './WebElement.js';

// Type helper for constructor
type Constructor<T> = new(...args: any[]) => T;

/**
 * Enhanced Component decorator that works with WebElement base class
 *
 * This decorator:
 * 1. Defines the custom element with the provided tag name
 * 2. Allows template initialization through HTML string or template element
 * 3. Supports plugins and mixins for enhanced functionality
 * 4. Preserves proper lifecycle method calls
 *
 * @param tagName The custom element tag name (e.g., 'x-button')
 * @param options Configuration options for the component
 * @returns A class decorator that enhances the target class
 */
export function EnhancedComponent(
  tagName: string,
  options: {
    template?: string | HTMLTemplateElement;
    styles?: string | CSSStyleSheet[];
    mixins?: Array<Constructor<object>>;
    plugins?: Array<Constructor<object>>;
    delegatesFocus?: boolean;
    mode?: ShadowRootMode | 'none';
  } = {},
) {
  return function<T extends Constructor<WebElement>>(
    targetClass: T,
  ): T {
    // We'll create a new class that extends the target class
    const EnhancedElement = class extends targetClass {
      static get observedAttributes(): string[] {
        // Combine our observedAttributes with parent class observedAttributes
        const parentClass = targetClass as unknown as typeof WebElement;
        const parentAttrs = parentClass.observedAttributes || [];

        // Get plugin attributes if available
        const pluginAttrs = options.plugins?.flatMap(plugin => {
          const pluginClass = plugin as unknown as typeof WebElement;
          return 'observedAttributes' in pluginClass
            ? (pluginClass as any).observedAttributes || []
            : [];
        }) || [];

        return [...new Set([...parentAttrs, ...pluginAttrs])];
      }

      // Store plugin instances
      #plugins: Array<object> = [];

      constructor(...args: any[]) {
        super(...args);

        // Apply mixins (these are applied to the prototype chain)
        if (options.mixins) {
          for (const mixin of options.mixins) {
            Object.assign(this, new mixin());
          }
        }

        // Initialize the shadow root template if provided
        if (this.shadowRoot && options.template) {
          if (typeof options.template === 'string') {
            const template = document.createElement('template');
            template.innerHTML = options.template;
            this.shadowRoot.appendChild(template.content.cloneNode(true));
          } else {
            this.shadowRoot.appendChild(
              options.template.content.cloneNode(true),
            );
          }
        }

        // Add styles to shadow root if provided
        if (this.shadowRoot && options.styles) {
          if (typeof options.styles === 'string') {
            const style = document.createElement('style');
            style.textContent = options.styles;
            this.shadowRoot.appendChild(style);
          } else {
            // Check if adoptedStyleSheets exists on the ShadowRoot
            if (this.shadowRoot.adoptedStyleSheets !== undefined) {
              this.shadowRoot.adoptedStyleSheets = options.styles;
            } else {
              // Fallback for browsers that don't support adoptedStyleSheets
              for (const sheet of options.styles) {
                const style = document.createElement('style');
                style.textContent = Array.from(sheet.cssRules)
                  .map(rule => rule.cssText)
                  .join('\n');
                this.shadowRoot.appendChild(style);
              }
            }
          }
        }

        // Initialize plugins
        if (options.plugins) {
          this.#plugins = options.plugins.map(Plugin => {
            // Cast this to any to avoid the type error
            // This is safe because we're only passing the element to the constructor
            return new Plugin(this as any);
          });
        }
      }

      // Override the core lifecycle methods to add plugin support

      override connectedCallback(): void {
        super.connectedCallback();
        // Call connectedCallback on plugins if they have it
        for (const plugin of this.#plugins) {
          if (
            'connectedCallback' in plugin
            && typeof (plugin as any).connectedCallback === 'function'
          ) {
            (plugin as any).connectedCallback();
          }
        }
      }

      override disconnectedCallback(): void {
        // Call disconnectedCallback on plugins if they have it
        for (const plugin of this.#plugins) {
          if (
            'disconnectedCallback' in plugin
            && typeof (plugin as any).disconnectedCallback === 'function'
          ) {
            (plugin as any).disconnectedCallback();
          }
        }
        super.disconnectedCallback();
      }

      override adoptedCallback(): void {
        super.adoptedCallback();
        // Call adoptedCallback on plugins if they have it
        for (const plugin of this.#plugins) {
          if (
            'adoptedCallback' in plugin
            && typeof (plugin as any).adoptedCallback === 'function'
          ) {
            (plugin as any).adoptedCallback();
          }
        }
      }

      override attributeChangedCallback(
        name: string,
        oldValue: string | null,
        newValue: string | null,
      ): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        // Call attributeChangedCallback on plugins if they have it
        for (const plugin of this.#plugins) {
          if (
            'attributeChangedCallback' in plugin
            && typeof (plugin as any).attributeChangedCallback === 'function'
          ) {
            (plugin as any).attributeChangedCallback(name, oldValue, newValue);
          }
        }
      }
    };

    // Override shadow root mode and delegatesFocus based on options
    if (options.mode !== undefined) {
      Object.defineProperty(EnhancedElement, 'shadowRootMode', {
        get: () => options.mode === 'none' ? null : options.mode,
      });
    }

    if (options.delegatesFocus !== undefined) {
      Object.defineProperty(EnhancedElement, 'delegatesFocus', {
        get: () => options.delegatesFocus,
      });
    }

    // Define the custom element if not already defined
    if (!customElements.get(tagName)) {
      customElements.define(
        tagName,
        EnhancedElement as unknown as CustomElementConstructor,
      );
    }

    // Return the enhanced class
    return EnhancedElement as unknown as T;
  };
}

/**
 * Create an HTML template from a template literal string
 * This is useful for syntax highlighting in IDEs
 */
export function html(strings: TemplateStringsArray, ...values: any[]): string {
  return strings.reduce((result, str, i) => {
    return result + str + (values[i] !== undefined ? values[i] : '');
  }, '');
}

/**
 * Create a CSS template from a template literal string
 * This is useful for syntax highlighting in IDEs
 */
export function css(strings: TemplateStringsArray, ...values: any[]): string {
  return strings.reduce((result, str, i) => {
    return result + str + (values[i] !== undefined ? values[i] : '');
  }, '');
}
