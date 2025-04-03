// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Content Security Policy options
 */
export interface CSPOptions {
  // Enable/disable CSP
  enabled: boolean;
  // Use nonces for inline scripts
  useNonces: boolean;
  // CSP directives
  directives: {
    'default-src'?: string[];
    'script-src'?: string[];
    'style-src'?: string[];
    'img-src'?: string[];
    'connect-src'?: string[];
    'font-src'?: string[];
    'object-src'?: string[];
    'media-src'?: string[];
    'frame-src'?: string[];
    [key: string]: string[] | undefined;
  };
  // Report URI for violations
  reportUri?: string;
  // Report-only mode (doesn't block, just reports)
  reportOnly?: boolean;
}

/**
 * Default CSP configuration
 */
export const defaultCSP: CSPOptions = {
  enabled: true,
  useNonces: true,
  directives: {
    'default-src': ['\'self\''],
    'script-src': ['\'self\'', '\'strict-dynamic\''],
    'style-src': ['\'self\'', '\'unsafe-inline\''],
    'img-src': ['\'self\'', 'data:'],
    'connect-src': ['\'self\''],
  },
};

// Store nonces to reuse within the same page/request
const pageNonces = new Set<string>();

/**
 * Cryptographically secure nonce generator
 */
export function generateNonce(): string {
  // Use crypto.getRandomValues for secure random values
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a nonce and remember it for the current page
 */
export function createNonce(): string {
  const nonce = generateNonce();
  pageNonces.add(nonce);
  return nonce;
}

/**
 * Check if a nonce is valid for the current page
 */
export function isValidNonce(nonce: string): boolean {
  return pageNonces.has(nonce);
}

/**
 * Generate CSP header value from options
 */
export function generateCSPHeader(options: CSPOptions = defaultCSP): string {
  if (!options.enabled) {
    return '';
  }

  const directives = Object.entries(options.directives).map(([key, values]) => {
    if (!values || values.length === 0) {
      return key;
    }

    // Add nonce sources if enabled
    if (options.useNonces && (key === 'script-src' || key === 'style-src')) {
      const nonceValues = Array.from(pageNonces).map(nonce =>
        `'nonce-${nonce}'`
      );
      values = [...values, ...nonceValues];
    }

    return `${key} ${values.join(' ')}`;
  });

  if (options.reportUri) {
    directives.push(`report-uri ${options.reportUri}`);
  }

  return directives.join('; ');
}

/**
 * Apply CSP to a web document
 */
export function applyCSP(
  document: Document,
  options: CSPOptions = defaultCSP,
): void {
  if (!options.enabled) {
    return;
  }

  // Create a meta tag for CSP
  const cspMeta = document.createElement('meta');
  cspMeta.httpEquiv = options.reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';
  cspMeta.content = generateCSPHeader(options);
  document.head.appendChild(cspMeta);
}

/**
 * Clear nonces when navigating away from the page
 */
export function clearNonces(): void {
  pageNonces.clear();
}
