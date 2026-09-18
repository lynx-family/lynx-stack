import { ABackgroundOnly } from './bg.jsx';

export function PartA() {
  return __MAIN_THREAD__
    ? <text attr-main='marker-a-skeleton' />
    : <ABackgroundOnly />;
}
