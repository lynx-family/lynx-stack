import { checkContainerType } from '../helpers';
import {
  AllByText,
  GetErrorFunction,
  SelectorMatcherOptions,
  Matcher,
} from '../../types';
import {
  fuzzyMatches,
  matches,
  makeNormalizer,
  getNodeText,
  buildQueries,
  getConfig,
} from './all-utils';
import type { LynxFiberElement } from '@lynx-js/lynx-dom';

const queryAllByText: AllByText = (
  container,
  text,
  {
    selector = '*',
    exact = true,
    collapseWhitespace,
    trim,
    ignore = getConfig().defaultIgnore,
    normalizer,
  } = {},
) => {
  checkContainerType(container);
  const matcher = exact ? matches : fuzzyMatches;
  const matchNormalizer = makeNormalizer({
    collapseWhitespace,
    trim,
    normalizer,
  });
  let baseArray: LynxFiberElement[] = [];
  if (typeof container.matches === 'function' && container.matches(selector)) {
    baseArray = [container];
  }
  return (
    [
      ...baseArray,
      ...Array.from(container.querySelectorAll<LynxFiberElement>(selector)),
    ]
      // TODO: `matches` according lib.dom.d.ts can get only `string` but according our code it can handle also boolean :)
      .filter(node => !ignore || !node.matches(ignore as string))
      .filter(node => matcher(getNodeText(node), node, text, matchNormalizer))
  );
};

const getMultipleError: GetErrorFunction<[unknown]> = (c, text) =>
  `Found multiple elements with the text: ${text}`;
const getMissingError: GetErrorFunction<[Matcher, SelectorMatcherOptions]> = (
  c,
  text,
  options = {},
) => {
  const { collapseWhitespace, trim, normalizer, selector } = options;
  const matchNormalizer = makeNormalizer({
    collapseWhitespace,
    trim,
    normalizer,
  });
  const normalizedText = matchNormalizer(text.toString());
  const isNormalizedDifferent = normalizedText !== text.toString();
  const isCustomSelector = (selector ?? '*') !== '*';
  return `Unable to find an element with the text: ${
    isNormalizedDifferent
      ? `${normalizedText} (normalized from '${text}')`
      : text
  }${
    isCustomSelector ? `, which matches selector '${selector}'` : ''
  }. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.`;
};

const [queryByText, getAllByText, getByText, findAllByText, findByText] =
  buildQueries(queryAllByText, getMultipleError, getMissingError);

export {
  queryByText,
  queryAllByText,
  getByText,
  getAllByText,
  findAllByText,
  findByText,
};
