# @lynx-js/web-security

Security features for the Lynx Web Platform, providing robust protection against common web vulnerabilities.

## Features

- **Content Security Policy (CSP)**: Prevent XSS attacks with nonce-based script execution
- **CSRF Protection**: Prevent cross-site request forgery with automated token handling
- **Input Sanitization**: Prevent XSS by sanitizing HTML, URLs, and user input

## Installation

```bash
# If you're using pnpm
pnpm add @lynx-js/web-security

# If you're using npm
npm install @lynx-js/web-security

# If you're using yarn
yarn add @lynx-js/web-security
```

## Usage

### Basic Setup

Initialize security features in your Lynx application:

```typescript
import { initSecurity } from '@lynx-js/web-security';

// Initialize security when the document is ready
document.addEventListener('DOMContentLoaded', () => {
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
    csrf: {
      enabled: true,
      cookieName: 'XSRF-TOKEN',
      headerName: 'X-XSRF-TOKEN',
      requireHeader: true,
    },
    sanitize: {
      sanitizeHtml: true,
      sanitizeUrl: true,
      sanitizeCss: true,
    },
  });
});
```

### Using in Components

```typescript
import { useSecurity } from '@lynx-js/web-security';

class SecureComponent extends HTMLElement {
  private security = useSecurity();

  connectedCallback() {
    // Generate a nonce for inline scripts
    const nonce = this.security.createNonce();

    // Add a script with the nonce
    const script = document.createElement('script');
    script.nonce = nonce;
    script.textContent =
      'console.log("This script will be allowed to execute");';
    this.appendChild(script);

    // Make a CSRF-protected fetch request
    this.security.fetchWithCSRF('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: 'example' }),
    }).then(response => response.json())
      .then(data => console.log(data));

    // Sanitize user input
    const userInput = '<script>alert("XSS")</script>Hello!';
    const sanitized = this.security.sanitizeInput(userInput);
    console.log(sanitized); // Outputs: "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;Hello!"

    // Sanitize HTML when needed
    const htmlContent = '<div>Safe <script>alert("unsafe")</script></div>';
    const safeHtml = this.security.sanitizeHtml(htmlContent);
    console.log(safeHtml); // Outputs: "<div>Safe </div>"
  }
}

customElements.define('secure-component', SecureComponent);
```

### Integration with Input Elements

The web-security package automatically enhances Lynx's standard input elements with sanitization:

```typescript
// XInput and XTextarea already have sanitization integrated
// User input is automatically sanitized to prevent XSS attacks
```

## Demo Component

A demo component is included to showcase the security features:

```html
<!-- Include the demo component in your HTML -->
<security-demo></security-demo>
```

## API Reference

### Content Security Policy (CSP)

- `generateNonce()`: Generate a random nonce
- `createNonce()`: Generate and register a nonce for the current page
- `isValidNonce(nonce: string)`: Check if a nonce is valid for the current page
- `applyCSP(document: Document, options?: CSPOptions)`: Apply CSP to a document
- `clearNonces()`: Clear all registered nonces

### CSRF Protection

- `getCSRFToken()`: Get the current CSRF token
- `fetchWithCSRF(input, init, options)`: Make a fetch request with CSRF protection
- `validateCSRFToken(token: string)`: Validate a CSRF token
- `initCSRF(document: Document, options?: CSRFOptions)`: Initialize CSRF protection

### Input Sanitization

- `sanitizeInput(value: string, allowHtml?: boolean)`: Sanitize general input
- `sanitizeHtml(input: string, options?: SanitizeOptions)`: Sanitize HTML content
- `sanitizeUrl(url: string, options?: SanitizeOptions)`: Sanitize a URL
- `sanitizeCss(css: string, options?: SanitizeOptions)`: Sanitize CSS content

## Configuration Options

### CSP Options

```typescript
interface CSPOptions {
  enabled: boolean;
  useNonces: boolean;
  directives: {
    'default-src'?: string[];
    'script-src'?: string[];
    'style-src'?: string[];
    // Other CSP directives...
  };
  reportUri?: string;
  reportOnly?: boolean;
}
```

### CSRF Options

```typescript
interface CSRFOptions {
  enabled: boolean;
  cookieName: string;
  headerName: string;
  requireHeader: boolean;
  safeMethods: string[];
}
```

### Sanitization Options

```typescript
interface SanitizeOptions {
  sanitizeHtml: boolean;
  sanitizeUrl: boolean;
  sanitizeCss: boolean;
  allowedTags: string[];
  allowedAttributes: Record<string, string[]>;
  allowedProtocols: string[];
  allowedCssProperties: string[];
}
```

## License

Apache License 2.0
