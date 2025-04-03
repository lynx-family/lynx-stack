// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Sanitization options
 */
export interface SanitizeOptions {
  // Enable/disable HTML sanitization
  sanitizeHtml: boolean;
  // Enable/disable URL sanitization
  sanitizeUrl: boolean;
  // Enable/disable CSS sanitization
  sanitizeCss: boolean;
  // Allowed HTML tags
  allowedTags: string[];
  // Allowed HTML attributes
  allowedAttributes: Record<string, string[]>;
  // Allowed URL protocols
  allowedProtocols: string[];
  // Allowed CSS properties
  allowedCssProperties: string[];
}

/**
 * Default sanitization options
 */
export const defaultSanitizeOptions: SanitizeOptions = {
  sanitizeHtml: true,
  sanitizeUrl: true,
  sanitizeCss: true,
  allowedTags: [
    'a',
    'b',
    'br',
    'code',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    'pre',
    'span',
    'strong',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'ul',
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'div': ['class', 'id', 'style'],
    'span': ['class', 'id', 'style'],
    'table': ['class', 'id', 'style', 'border'],
    'td': ['colspan', 'rowspan', 'style'],
    'th': ['colspan', 'rowspan', 'style'],
    '*': ['class', 'id'],
  },
  allowedProtocols: ['http:', 'https:', 'mailto:', 'tel:'],
  allowedCssProperties: [
    'color',
    'background-color',
    'font-size',
    'font-weight',
    'font-style',
    'margin',
    'padding',
    'border',
    'text-align',
    'width',
    'height',
    'display',
  ],
};

/**
 * Sanitize HTML content
 */
export function sanitizeHtml(
  input: string,
  options: SanitizeOptions = defaultSanitizeOptions,
): string {
  if (!options.sanitizeHtml || !input) {
    return input;
  }

  try {
    // Create a temporary document to parse the HTML
    const doc = new DOMParser().parseFromString(
      `<lynx-sanitizer>${input}</lynx-sanitizer>`,
      'text/html',
    );

    // Process element and its children recursively
    function processElement(element: Element): void {
      // Create an array of children to avoid modification issues during iteration
      const children = Array.from(element.children);

      for (const child of children) {
        const tagName = child.tagName.toLowerCase();

        // Remove elements with tags not in the allowed list
        if (!options.allowedTags.includes(tagName)) {
          element.removeChild(child);
          continue;
        }

        // Filter attributes
        Array.from(child.attributes).forEach(attr => {
          const attrName = attr.name.toLowerCase();

          // Check if attribute is allowed for this tag or for all tags (*)
          const isAllowed =
            (options.allowedAttributes[tagName]?.includes(attrName))
            || (options.allowedAttributes['*']?.includes(attrName));

          if (!isAllowed) {
            child.removeAttribute(attrName);
          } else if (attrName === 'href' || attrName === 'src') {
            // Sanitize URLs
            if (options.sanitizeUrl) {
              try {
                const url = attr.value;
                const urlObj = new URL(url, window.location.href);
                if (!options.allowedProtocols.includes(urlObj.protocol)) {
                  child.removeAttribute(attrName);
                }
              } catch (e) {
                // Invalid URL, remove the attribute
                child.removeAttribute(attrName);
              }
            }
          } else if (attrName === 'style' && options.sanitizeCss) {
            // Sanitize inline CSS
            child.setAttribute(
              attrName,
              sanitizeCss(attr.value, options),
            );
          }
        });

        // Process child elements recursively
        processElement(child);
      }
    }

    // Process the container element
    const sanitizerElement = doc.querySelector('lynx-sanitizer');
    if (sanitizerElement) {
      processElement(sanitizerElement);
      return sanitizerElement.innerHTML;
    }

    return '';
  } catch (e) {
    // If there's an error during sanitization, return an empty string for safety
    console.error('Error during HTML sanitization:', e);
    return '';
  }
}

/**
 * Sanitize a URL
 */
export function sanitizeUrl(
  url: string,
  options: SanitizeOptions = defaultSanitizeOptions,
): string {
  if (!options.sanitizeUrl || !url) {
    return url;
  }

  try {
    const urlObj = new URL(url, window.location.href);
    if (!options.allowedProtocols.includes(urlObj.protocol)) {
      // Return a safe default if protocol is not allowed
      return 'about:blank';
    }
    return urlObj.toString();
  } catch (e) {
    // Invalid URL, return safe default
    return 'about:blank';
  }
}

/**
 * Sanitize CSS content
 */
export function sanitizeCss(
  css: string,
  options: SanitizeOptions = defaultSanitizeOptions,
): string {
  if (!options.sanitizeCss || !css) {
    return css;
  }

  // Simple CSS sanitization - only allow specific properties
  const rules = css.split(';').filter(Boolean);
  const sanitizedRules = rules.filter(rule => {
    const property = rule.split(':')[0]?.trim().toLowerCase();
    return property && options.allowedCssProperties.includes(property);
  });

  return sanitizedRules.join('; ');
}

/**
 * Sanitize input value (for forms)
 */
export function sanitizeInput(
  value: string,
  allowHtml = false,
  options: SanitizeOptions = defaultSanitizeOptions,
): string {
  if (!value) {
    return value;
  }

  if (allowHtml) {
    return sanitizeHtml(value, options);
  }
  // Escape HTML entities to prevent XSS
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

/**
 * Enhance an input element class with sanitization capabilities
 */
export function enhanceInputWithSanitization(
  InputClass: typeof HTMLElement,
): void {
  const originalSetValue = InputClass.prototype.setAttribute;

  InputClass.prototype.setAttribute = function(
    name: string,
    value: string,
  ): void {
    if (name === 'value') {
      // Sanitize the input value before setting
      originalSetValue.call(this, name, sanitizeInput(value));
    } else {
      originalSetValue.call(this, name, value);
    }
  };
}
