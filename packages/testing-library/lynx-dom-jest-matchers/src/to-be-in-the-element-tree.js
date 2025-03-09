import { checkLynxFiberElement } from './utils';

export function toBeInTheElementTree(element) {
  if (element !== null || !this.isNot) {
    checkLynxFiberElement(element, toBeInTheElementTree, this);
  }
  const pass = element === null
    ? false
    : element.ownerDocument === element.getRootNode({ composed: true });

  const errorFound = () => {
    return `expected document not to contain element, found ${element} instead`;
  };
  const errorNotFound = () => {
    return `element could not be found in the elementTree`;
  };

  return {
    pass,
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toBeInTheElementTree`,
          'element',
          '',
        ),
        '',
        // eslint-disable-next-line new-cap
        this.utils.RECEIVED_COLOR(this.isNot ? errorFound() : errorNotFound()),
      ].join('\n');
    },
  };
}
