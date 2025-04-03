// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useSecurity, initSecurity } from '../index';

/**
 * A demo component that showcases the security features.
 * This can be used in examples to demonstrate how to use the security module.
 */
export class SecurityDemo extends HTMLElement {
  private securityFeatures = useSecurity();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // Initialize security features
    if (document) {
      initSecurity(document, {
        csp: {
          enabled: true,
          useNonces: true,
          directives: {
            'default-src': ['\'self\''],
            'script-src': ['\'self\'', '\'strict-dynamic\''],
            'style-src': ['\'self\'', '\'unsafe-inline\''],
            'img-src': ['\'self\'', 'data:'],
            'connect-src': ['\'self\''],
          },
        },
      });
    }

    this.render();
    this.addEventListeners();
  }

  private render() {
    if (!this.shadowRoot) return;

    const nonce = this.securityFeatures.createNonce();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: system-ui, sans-serif;
          padding: 1rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          margin: 1rem 0;
        }
        
        .container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .section {
          padding: 1rem;
          border: 1px solid #eee;
          border-radius: 4px;
        }
        
        .section h3 {
          margin-top: 0;
          color: #333;
        }
        
        button {
          padding: 0.5rem 1rem;
          background: #0070f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        button:hover {
          background: #0051a2;
        }
        
        input, textarea {
          padding: 0.5rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          width: 100%;
          box-sizing: border-box;
        }
        
        .output {
          background: #f7f7f7;
          padding: 0.5rem;
          border-radius: 4px;
          white-space: pre-wrap;
          max-height: 200px;
          overflow-y: auto;
        }
      </style>
      
      <div class="container">
        <h2>Lynx Security Demo</h2>
        
        <div class="section">
          <h3>Content Security Policy</h3>
          <p>CSP nonce generated: <code>${nonce}</code></p>
          <p>The following script has a valid nonce and will execute:</p>
          <script nonce="${nonce}">
            // This script has a valid nonce and will execute
            const validScriptContainer = document.createElement('div');
            validScriptContainer.textContent = 'CSP with valid nonce: Script executed successfully';
            document.currentScript.parentNode.appendChild(validScriptContainer);
          </script>
        </div>
        
        <div class="section">
          <h3>CSRF Protection</h3>
          <p>Current CSRF token: <code>${this.securityFeatures.getCsrfToken()}</code></p>
          <button id="fetch-btn">Make CSRF-Protected Fetch Request</button>
          <div class="output" id="csrf-output"></div>
        </div>
        
        <div class="section">
          <h3>Input Sanitization</h3>
          <p>Try entering HTML with potential XSS</p>
          <textarea id="html-input" placeholder="Enter HTML here (e.g. <script>alert('xss')</script>)"></textarea>
          <button id="sanitize-btn">Sanitize HTML</button>
          <div>
            <h4>Original Input:</h4>
            <div class="output" id="original-output"></div>
            
            <h4>Sanitized Result:</h4>
            <div class="output" id="sanitized-output"></div>
            
            <h4>Rendered Result (safe):</h4>
            <div class="output" id="rendered-output"></div>
          </div>
        </div>
      </div>
    `;
  }

  private addEventListeners() {
    if (!this.shadowRoot) return;

    // CSRF Protection demo
    const fetchBtn = this.shadowRoot.querySelector('#fetch-btn');
    const csrfOutput = this.shadowRoot.querySelector('#csrf-output');

    if (fetchBtn && csrfOutput) {
      fetchBtn.addEventListener('click', async () => {
        try {
          // Using fetchWithCSRF for CSRF protection
          const response = await this.securityFeatures.fetchWithCSRF(
            'https://jsonplaceholder.typicode.com/todos/1',
          );
          const data = await response.json();
          csrfOutput.textContent = JSON.stringify(data, null, 2);
        } catch (error) {
          csrfOutput.textContent = `Error: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      });
    }

    // Input Sanitization demo
    const htmlInput = this.shadowRoot.querySelector('#html-input');
    const sanitizeBtn = this.shadowRoot.querySelector('#sanitize-btn');
    const originalOutput = this.shadowRoot.querySelector('#original-output');
    const sanitizedOutput = this.shadowRoot.querySelector('#sanitized-output');
    const renderedOutput = this.shadowRoot.querySelector('#rendered-output');

    if (
      htmlInput && sanitizeBtn && originalOutput && sanitizedOutput
      && renderedOutput
    ) {
      sanitizeBtn.addEventListener('click', () => {
        const inputValue = (htmlInput as HTMLTextAreaElement).value;

        // Display original input
        originalOutput.textContent = inputValue;

        // Get sanitized HTML
        const sanitizedHTML = this.securityFeatures.sanitizeHtml(inputValue);

        // Display sanitized output
        sanitizedOutput.textContent = sanitizedHTML;

        // Display rendered output (safe)
        renderedOutput.innerHTML = sanitizedHTML;
      });
    }
  }
}

// Register the element if we're in a browser environment
if (typeof customElements !== 'undefined') {
  customElements.define('security-demo', SecurityDemo);
}
