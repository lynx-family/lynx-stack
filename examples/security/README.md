# Lynx Security Demo

This demo application showcases three fundamental web security features implemented in a Lynx-compatible way:

## Security Features Demonstrated

1. **Content Security Policy (CSP)**
   - Demonstrates nonce-based script execution control
   - Shows how CSP can block unauthorized scripts
   - Illustrates proper nonce generation and usage

2. **Cross-Site Request Forgery (CSRF) Protection**
   - Shows token-based request validation
   - Demonstrates how invalid requests are blocked
   - Illustrates proper CSRF token generation

3. **Input Sanitization**
   - Demonstrates cleaning of potentially dangerous HTML
   - Shows how different XSS vectors are neutralized
   - Provides examples of common attack patterns

## Running the Demo

1. Start the development server:
   ```
   cd examples/security
   pnpm dev
   ```

2. Scan the QR code with the Lynx Explorer app on your device.

## Implementation Notes

- This demo is specifically optimized for the Lynx runtime environment
- Uses standard onClick event handlers for better Lynx compatibility
- Implements mock security features to demonstrate concepts without browser dependencies
- Mobile-friendly UI with improved touch targets

## Cross-Platform Testing

While this demo is optimized for Lynx, you can also test it in a regular web browser by navigating to the development server URL (typically http://localhost:3000).

## Structure

- `src/App.tsx` - Main demo component with all interactive features
- `src/App.css` - Styling optimized for mobile devices
- `src/api/` - Mock API implementation for CSRF demo
