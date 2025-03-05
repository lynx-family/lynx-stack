// WARNING: `lz-string` only has a default export but statically we assume named exports are allowed
// TODO: Statically verify we don't rely on NodeJS implicit named imports.
import lzString from 'lz-string';
import { type OptionsReceived } from 'pretty-format';
import { getQueriesForElement } from './get-queries-for-element';
import { getDocument } from './helpers';
import { logDOM } from './pretty-dom';
import * as queries from './queries';

function unindent(string: string) {
  // remove white spaces first, to save a few bytes.
  // testing-playground will reformat on load any ways.
  return string.replace(/[ \t]*[\n][ \t]*/g, '\n');
}

function encode(value: string) {
  return lzString.compressToEncodedURIComponent(unindent(value));
}

function getPlaygroundUrl(markup: string) {
  return `https://testing-playground.com/#markup=${encode(markup)}`;
}

const debug = (
  element?: Array<Element | HTMLDocument> | Element | HTMLDocument,
  maxLength?: number,
  options?: OptionsReceived,
): void =>
  Array.isArray(element)
    ? element.forEach(el => logDOM(el, maxLength, options))
    : logDOM(element, maxLength, options);

const logTestingPlaygroundURL = (element = getDocument().body) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!element || !('innerHTML' in element)) {
    console.log(`The element you're providing isn't a valid DOM element.`);
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!element.innerHTML) {
    console.log(`The provided element doesn't have any children.`);
    return;
  }
  const playgroundUrl = getPlaygroundUrl(element.innerHTML);
  console.log(`Open this URL in your browser\n\n${playgroundUrl}`);
  return playgroundUrl;
};

const initialValue = { debug, logTestingPlaygroundURL };

// export const screen = getQueriesForElement(document.body, queries, initialValue)
export const getScreen = () => {
  return getQueriesForElement(
    lynxDOM.mainThread.elementTree.root,
    queries,
    initialValue,
  );
};
