import { setUpBackgroundThread } from './background.js';
import { setUpMainThread } from './main-thread.js';

if (__MAIN_THREAD__) {
  setUpMainThread();
} else if (__BACKGROUND__) {
  setUpBackgroundThread();
}
