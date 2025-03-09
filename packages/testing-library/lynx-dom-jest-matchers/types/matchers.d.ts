import { type ARIARole } from 'aria-query';

declare namespace matchers {
  interface TestingLibraryMatchers<E, R> {
    /**
     * @description
     * Assert whether an element is present in the document or not.
     * @example
     * <svg data-testid="svg-element"></svg>
     *
     * expect(queryByTestId('svg-element')).toBeInTheElementTree()
     * expect(queryByTestId('does-not-exist')).not.toBeInTheElementTree()
     */
    toBeInTheElementTree(): R;
    /**
     * @description
     * Check whether the given element has a text content or not.
     *
     * When a string argument is passed through, it will perform a partial case-sensitive match to the element
     * content.
     *
     * To perform a case-insensitive match, you can use a RegExp with the `/i` modifier.
     *
     * If you want to match the whole content, you can use a RegExp to do it.
     * @example
     * <span data-testid="text-content">Text Content</span>
     *
     * const element = getByTestId('text-content')
     * expect(element).toHaveTextContent('Content')
     * // to match the whole content
     * expect(element).toHaveTextContent(/^Text Content$/)
     * // to use case-insentive match
     * expect(element).toHaveTextContent(/content$/i)
     * expect(element).not.toHaveTextContent('content')
     * @see
     * [testing-library/jest-dom#tohavetextcontent](https://github.com/testing-library/jest-dom#tohavetextcontent)
     */
    toHaveTextContent(
      text: string | RegExp,
      options?: { normalizeWhitespace: boolean },
    ): R;
  }
}

// Needs to extend Record<string, any> to be accepted by expect.extend()
// as it requires a string index signature.
declare const matchers:
  & matchers.TestingLibraryMatchers<any, void>
  & Record<string, any>;
export = matchers;
