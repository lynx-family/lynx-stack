import { getQueriesForElement } from './get-queries-for-element';
import * as queries from './queries';

const initialValue = {};

// export const screen = getQueriesForElement(document.body, queries, initialValue)
export const getScreen = () => {
  return getQueriesForElement(
    lynxDOM.mainThread.elementTree.root,
    queries,
    initialValue,
  );
};
