// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * CSRF protection options
 */
export interface CSRFOptions {
  // Enable/disable CSRF protection
  enabled: boolean;
  // Name of the cookie that will store the CSRF token
  cookieName: string;
  // Name of the header that will contain the CSRF token
  headerName: string;
  // Whether to require the token in the header
  requireHeader: boolean;
  // List of methods that are exempt from CSRF protection
  safeMethods: string[];
}

/**
 * Default CSRF options
 */
export const defaultCSRFOptions: CSRFOptions = {
  enabled: true,
  cookieName: 'XSRF-TOKEN',
  headerName: 'X-XSRF-TOKEN',
  requireHeader: true,
  safeMethods: ['GET', 'HEAD', 'OPTIONS'],
};

// Session storage for CSRF token
let currentCSRFToken: string | null = null;

/**
 * Generate a secure CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the current CSRF token, generating a new one if needed
 */
export function getCSRFToken(): string {
  if (!currentCSRFToken) {
    currentCSRFToken = generateCSRFToken();
  }
  return currentCSRFToken;
}

/**
 * Set a CSRF token cookie
 */
export function setCSRFCookie(
  document: Document,
  options: CSRFOptions = defaultCSRFOptions,
): void {
  if (!options.enabled) {
    return;
  }

  const token = getCSRFToken();
  document.cookie =
    `${options.cookieName}=${token}; path=/; SameSite=Strict; Secure`;
}

/**
 * Attach CSRF token to fetch/XHR requests
 */
export function attachCSRFToken(
  headers: Headers | Record<string, string>,
  options: CSRFOptions = defaultCSRFOptions,
): void {
  if (!options.enabled) {
    return;
  }

  const token = getCSRFToken();

  if (headers instanceof Headers) {
    headers.append(options.headerName, token);
  } else {
    headers[options.headerName] = token;
  }
}

/**
 * Validate a CSRF token against the stored token
 */
export function validateCSRFToken(token: string): boolean {
  return token === currentCSRFToken;
}

/**
 * CSRF protection middleware for fetch
 */
export function fetchWithCSRF(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: CSRFOptions = defaultCSRFOptions,
): Promise<Response> {
  if (!options.enabled) {
    return fetch(input, init);
  }

  const method = init?.method?.toUpperCase() || 'GET';

  // Skip CSRF protection for safe methods
  if (options.safeMethods.includes(method)) {
    return fetch(input, init);
  }

  // Initialize headers if they don't exist
  const headers = new Headers(init?.headers);

  // Add CSRF token to headers
  attachCSRFToken(headers, options);

  // Return fetch with modified headers
  return fetch(input, {
    ...init,
    headers,
  });
}

/**
 * Initialize CSRF protection
 */
export function initCSRF(
  document: Document,
  options: CSRFOptions = defaultCSRFOptions,
): void {
  if (!options.enabled) {
    return;
  }

  // Set the CSRF cookie
  setCSRFCookie(document, options);

  // Add hidden input to all forms
  document.querySelectorAll('form').forEach(form => {
    if (form.method.toUpperCase() !== 'GET') {
      // Check if the form already has a CSRF token input
      const existingInput = form.querySelector(
        `input[name="${options.headerName}"]`,
      );
      if (!existingInput) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = options.headerName;
        input.value = getCSRFToken();
        form.appendChild(input);
      }
    }
  });

  // Patch XMLHttpRequest to include CSRF token
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method: string, ...args: any[]) {
    // @ts-ignore
    originalOpen.apply(this, [method, ...args]);

    if (!options.safeMethods.includes(method.toUpperCase())) {
      this.setRequestHeader(options.headerName, getCSRFToken());
    }
  };
}
