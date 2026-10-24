import { LazyBackgroundOnly } from './lazy-background-only.jsx';

export function LazyPart() {
  return __MAIN_THREAD__
    ? <text attr-main='marker-lazy-skeleton' />
    : <LazyBackgroundOnly />;
}
