/**
 * File that tests whether the TypeScript typings work as expected.
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { expect } from 'vitest';
import * as matchers from '../../matchers';

expect.extend(matchers);

const element: HTMLElement = document.body;

function customExpect(
  _actual: HTMLElement,
):
  | matchers.TestingLibraryMatchers<unknown, void>
  | matchers.TestingLibraryMatchers<unknown, Promise<void>>
{
  throw new Error('Method not implemented.');
}

customExpect(element).toBeInTheElementTree();
customExpect(element).toHaveTextContent('Text');
customExpect(element).toHaveTextContent(/Text/);
customExpect(element).toHaveTextContent('Text', { normalizeWhitespace: true });
customExpect(element).toHaveTextContent(/Text/, { normalizeWhitespace: true });

// @ts-expect-error The types accidentally allowed any property by falling back to "any"
customExpect(element).nonExistentProperty();
