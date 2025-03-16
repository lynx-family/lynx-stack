interface ErrorBoundaryOptions {
  fallbackComponent?: string;
  onError?: (error: Error) => void;
  onRetry?: () => void;
}

export class ErrorBoundary extends HTMLElement {
  private error: Error | null = null;
  private options: ErrorBoundaryOptions;
  private originalContent: string;

  static get observedAttributes(): string[] {
    return ['fallback-component'];
  }

  constructor(options: ErrorBoundaryOptions = {}) {
    super();
    this.options = options;
    this.originalContent = '';
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.originalContent = this.innerHTML;
    this.render();
  }

  private render(): void {
    if (!this.shadowRoot) return;

    if (this.error) {
      this.shadowRoot.innerHTML = this.getFallbackTemplate();
      const retryButton = this.shadowRoot.querySelector('.retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', this.handleRetry.bind(this));
      }
    } else {
      this.innerHTML = this.originalContent;
    }
  }

  private getFallbackTemplate(): string {
    if (this.options.fallbackComponent) {
      return `<${this.options.fallbackComponent}></${this.options.fallbackComponent}>`;
    }

    return `
      <div class="error-boundary">
        <h3>An error occurred</h3>
        <p class="error-message">${this.error?.message || 'Unknown error'}</p>
        <button class="retry-button">Retry</button>
      </div>
      <style>
        .error-boundary {
          padding: 16px;
          border: 1px solid #ff0000;
          border-radius: 4px;
          margin: 8px;
        }
        .error-message {
          color: #ff0000;
        }
        .retry-button {
          padding: 8px 16px;
          background: #0066cc;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
      </style>
    `;
  }

  handleError(error: Error): void {
    this.error = error;
    this.options.onError?.(error);
    this.render();
  }

  private handleRetry(): void {
    this.error = null;
    this.options.onRetry?.();
    this.render();
  }

  attributeChangedCallback(
    name: string,
    oldValue: string,
    newValue: string,
  ): void {
    if (name === 'fallback-component' && oldValue !== newValue) {
      this.options.fallbackComponent = newValue;
      if (this.error) {
        this.render();
      }
    }
  }
}

// Register the custom element
customElements.define('lynx-error-boundary', ErrorBoundary);
