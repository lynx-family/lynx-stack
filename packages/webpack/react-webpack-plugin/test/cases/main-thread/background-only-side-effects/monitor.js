export class JSBMonitor {
  constructor() {
    console.info('marker-monitor-constructed');
  }
  start() {
    console.info('marker-monitor-started');
  }
}

export const jsbMonitor = new JSBMonitor();
