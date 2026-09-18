import { jsbMonitor } from './monitor.js';

export function Feed() {
  jsbMonitor.start();
  return <text attr-feed='marker-feed-content' />;
}
