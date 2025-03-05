/**
 * File that tests whether the TypeScript typings for @types/jest work as expected.
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { expect } from 'vitest';
import '../../vitest';

const element: HTMLElement = document.body;

expect(element).toBeInTheDOM();
expect(element).toBeInTheDOM(document.body);
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
expect(element).toBeEmpty();
expect(element).toBeDisabled();
expect(element).toBeEnabled();
expect(element).toBeInvalid();
expect(element).toBeRequired();
expect(element).toBeValid();
expect(element).toContainElement(document.body);
expect(element).toContainElement(null);
expect(element).toContainHTML('body');
expect(element).toHaveAttribute('attr');
expect(element).toHaveAttribute('attr', true);
expect(element).toHaveAttribute('attr', 'yes');
expect(element).toHaveClass();
expect(element).toHaveClass('cls1');
expect(element).toHaveClass('cls1', 'cls2', 'cls3', 'cls4');
expect(element).toHaveClass('cls1', { exact: true });
expect(element).toHaveDisplayValue('str');
expect(element).toHaveDisplayValue(['str1', 'str2']);
expect(element).toHaveDisplayValue(/str/);
expect(element).toHaveDisplayValue([/str1/, 'str2']);
expect(element).toHaveFocus();
expect(element).toHaveFormValues({ foo: 'bar', baz: 1 });
expect(element).toHaveStyle('display: block');
expect(element).toHaveStyle({ display: 'block', width: 100 });
expect(element).toHaveTextContent('Text');
expect(element).toHaveTextContent(/Text/);
expect(element).toHaveTextContent('Text', { normalizeWhitespace: true });
expect(element).toHaveTextContent(/Text/, { normalizeWhitespace: true });
expect(element).toHaveValue();
expect(element).toHaveValue('str');
expect(element).toHaveValue(['str1', 'str2']);
expect(element).toHaveValue(1);
expect(element).toHaveValue(null);
expect(element).toBeChecked();
expect(element).toHaveDescription('some description');
expect(element).toHaveDescription(/some description/);
expect(element).toHaveDescription(expect.stringContaining('partial'));
expect(element).toHaveDescription();
expect(element).toHaveAccessibleDescription('some description');
expect(element).toHaveAccessibleDescription(/some description/);
expect(element).toHaveAccessibleDescription(expect.stringContaining('partial'));
expect(element).toHaveAccessibleDescription();
expect(element).toHaveAccessibleName('a label');
expect(element).toHaveAccessibleName(/a label/);
expect(element).toHaveAccessibleName(expect.stringContaining('partial label'));
expect(element).toHaveAccessibleName();
expect(element).toHaveErrorMessage(
  'Invalid time: the time must be between 9:00 AM and 5:00 PM',
);
expect(element).toHaveErrorMessage(/invalid time/i);
expect(element).toHaveErrorMessage(expect.stringContaining('Invalid time'));
expect(element).toHaveRole('button');

expect(element).not.toBeInTheDOM();
expect(element).not.toBeInTheDOM(document.body);
expect(element).not.toBeInTheDocument();
expect(element).not.toBeVisible();
expect(element).not.toBeEmpty();
expect(element).not.toBeEmptyDOMElement();
expect(element).not.toBeDisabled();
expect(element).not.toBeEnabled();
expect(element).not.toBeInvalid();
expect(element).not.toBeRequired();
expect(element).not.toBeValid();
expect(element).not.toContainElement(document.body);
expect(element).not.toContainElement(null);
expect(element).not.toContainHTML('body');
expect(element).not.toHaveAttribute('attr');
expect(element).not.toHaveAttribute('attr', true);
expect(element).not.toHaveAttribute('attr', 'yes');
expect(element).not.toHaveClass();
expect(element).not.toHaveClass('cls1');
expect(element).not.toHaveClass('cls1', 'cls2', 'cls3', 'cls4');
expect(element).not.toHaveClass('cls1', { exact: true });
expect(element).not.toHaveDisplayValue('str');
expect(element).not.toHaveDisplayValue(['str1', 'str2']);
expect(element).not.toHaveDisplayValue(/str/);
expect(element).not.toHaveDisplayValue([/str1/, 'str2']);
expect(element).not.toHaveFocus();
expect(element).not.toHaveFormValues({ foo: 'bar', baz: 1 });
expect(element).not.toHaveStyle('display: block');
expect(element).not.toHaveTextContent('Text');
expect(element).not.toHaveTextContent(/Text/);
expect(element).not.toHaveTextContent('Text', { normalizeWhitespace: true });
expect(element).not.toHaveTextContent(/Text/, { normalizeWhitespace: true });
expect(element).not.toHaveValue();
expect(element).not.toHaveValue('str');
expect(element).not.toHaveValue(['str1', 'str2']);
expect(element).not.toHaveValue(1);
expect(element).not.toBeChecked();
expect(element).not.toHaveDescription('some description');
expect(element).not.toHaveDescription();
expect(element).not.toHaveAccessibleDescription('some description');
expect(element).not.toHaveAccessibleDescription();
expect(element).not.toHaveAccessibleName('a label');
expect(element).not.toHaveAccessibleName();
expect(element).not.toBePartiallyChecked();
expect(element).not.toHaveErrorMessage();
expect(element).not.toHaveErrorMessage('Pikachu!');
expect(element).not.toHaveRole('button');

// @ts-expect-error The types accidentally allowed any property by falling back to "any"
expect(element).nonExistentProperty();
