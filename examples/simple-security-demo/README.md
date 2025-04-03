# Lynx Security Features Simple Demo

This standalone HTML demo showcases the core security features implemented in the Lynx framework:

- **Content Security Policy (CSP)**: Prevents XSS attacks by controlling which scripts can execute
- **CSRF Protection**: Prevents cross-site request forgery by validating tokens
- **Input Sanitization**: Prevents XSS attacks by cleaning user input

## Getting Started

There are two ways to run the demo:

### Option 1: Open the HTML file directly

Simply open the `index.html` file in a web browser. This will demonstrate the security features, but without actual CSP header enforcement.

### Option 2: Use the Node.js server (recommended)

For a more realistic demonstration with actual CSP headers:

1. Make sure you have Node.js installed
2. Run the server:
   ```
   node server.js
   ```
3. Open your browser and navigate to `http://localhost:3000`

The Node.js server adds real Content-Security-Policy headers and dynamically adds nonces to scripts, demonstrating how CSP works in a production environment.

## Features Demonstrated

### Content Security Policy (CSP)

The demo shows how to:

- Generate and use nonces for inline scripts
- Implement script execution controls
- Demonstrate the difference between scripts with and without nonces

### CSRF Protection

The demo includes:

- CSRF token generation
- Token validation for API requests
- Visualization of valid vs. invalid requests

### Input Sanitization

The demo features:

- HTML sanitization to prevent XSS attacks
- Removal of dangerous tags and attributes
- Visual comparison of original vs. sanitized content

## Implementation Details

This standalone demo implements simplified versions of the security utilities found in the Lynx framework's `@lynx-js/web-security` package. It includes code examples showing how each security feature is implemented.

## Note

In a production environment, these security features would be integrated with server-side components and properly configured CSP headers. This demo provides a client-side simulation to showcase the concepts and implementation details.
