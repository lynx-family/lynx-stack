import { getMessage, matches, normalize } from './utils';

export function toHaveTextContent(
  node,
  checkWith,
  options = { normalizeWhitespace: true },
) {
  const textContent = options.normalizeWhitespace
    ? normalize(node.textContent)
    : node.textContent.replace(/\u00a0/g, ' '); // Replace &nbsp; with normal spaces

  const checkingWithEmptyString = textContent !== '' && checkWith === '';

  return {
    pass: !checkingWithEmptyString && matches(textContent, checkWith),
    message: () => {
      const to = this.isNot ? 'not to' : 'to';
      return getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toHaveTextContent`,
          'element',
          '',
        ),
        checkingWithEmptyString
          ? `Checking with empty string will always match, use .toBeEmptyLynxFiberElement() instead`
          : `Expected element ${to} have text content`,
        checkWith,
        'Received',
        textContent,
      );
    },
  };
}
