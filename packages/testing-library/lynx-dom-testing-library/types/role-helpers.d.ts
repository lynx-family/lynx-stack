import type { LynxFiberElement } from '@lynx-js/lynx-dom';

export function logRoles(
  container: LynxFiberElement,
  options?: LogRolesOptions,
): string;

interface LogRolesOptions {
  hidden?: boolean;
}

export function getRoles(container: LynxFiberElement): {
  [index: string]: LynxFiberElement[];
};

/**
 * https://testing-library.com/docs/dom-testing-library/api-helpers#isinaccessible
 */
export function isInaccessible(element: Element): boolean;

export function computeHeadingLevel(element: Element): number | undefined;
