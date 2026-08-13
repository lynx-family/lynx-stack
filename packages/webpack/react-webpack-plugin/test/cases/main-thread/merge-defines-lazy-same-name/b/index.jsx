import { BBackgroundOnly } from './bg.jsx';

export function PartB() {
  return __MAIN_THREAD__
    ? <text attr-main='marker-b-skeleton' />
    : <BBackgroundOnly />;
}
