/**
 * File that tests whether the TypeScript typings for @types/jest work as expected.
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { expect } from 'vitest';
import '../../vitest';

const element: HTMLElement = document.body;

expect(element).toBeInTheElementTree();
expect(element).toHaveTextContent('Text');
expect(element).toHaveTextContent(/Text/);
expect(element).toHaveTextContent('Text', { normalizeWhitespace: true });
expect(element).toHaveTextContent(/Text/, { normalizeWhitespace: true });
expect(element).not.toHaveTextContent('Text');
expect(element).not.toHaveTextContent(/Text/);
expect(element).not.toHaveTextContent('Text', { normalizeWhitespace: true });
expect(element).not.toHaveTextContent(/Text/, { normalizeWhitespace: true });

// @ts-expect-error The types accidentally allowed any property by falling back to "any"
expect(element).nonExistentProperty();
