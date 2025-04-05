// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  CSPOptions,
  generateNonce,
  applyCSP,
  createNonce,
  isValidNonce,
  clearNonces,
} from './csp';
import {
  CSRFOptions,
  getCSRFToken,
  initCSRF,
  fetchWithCSRF,
  validateCSRFToken,
} from './csrf';
import {
  SanitizeOptions,
  sanitizeHtml,
  sanitizeUrl,
  sanitizeInput,
  sanitizeCss,
  enhanceInputWithSanitization,
} from './sanitize';

// Export the demo component
export { SecurityDemo } from './demo/SecurityDemo';

/**
 * Combined security options interface
 */
export interface SecurityOptions {
  csp: CSPOptions;
  csrf: CSRFOptions;
  sanitize: SanitizeOptions;
}

/**
 * Unified security hooks for components
 */
export function useSecurity() {
  return {
    // CSP utilities
    generateNonce,
    createNonce,
    isValidNonce,

    // CSRF utilities
    getCsrfToken: getCSRFToken,
    fetchWithCSRF,
    validateCSRFToken,

    // Sanitization utilities
    sanitizeInput,
    sanitizeHtml,
    sanitizeUrl,
    sanitizeCss,
  };
}

/**
 * Initialize all security features
 */
export function initSecurity(
  document: Document,
  options?: Partial<SecurityOptions>,
): void {
  // Apply CSP
  applyCSP(document, options?.csp);

  // Initialize CSRF protection
  initCSRF(document, options?.csrf);
}

// Re-export all individual utilities
export {
  CSPOptions,
  generateNonce,
  applyCSP,
  createNonce,
  isValidNonce,
  clearNonces,
  CSRFOptions,
  getCSRFToken,
  initCSRF,
  fetchWithCSRF,
  validateCSRFToken,
  SanitizeOptions,
  sanitizeHtml,
  sanitizeUrl,
  sanitizeInput,
  sanitizeCss,
  enhanceInputWithSanitization,
};
