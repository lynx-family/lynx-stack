// Here we use the "User Timing API" to collect samples for the
// native profiling tools of browsers. These timings will show
// up in the "Timing" category.

const markName = (s: string) => `⚛ ${s}`;

const supportsPerformance = globalThis.performance
  && typeof globalThis.performance.getEntriesByName === 'function';

export function recordMark(s: string) {
  if (supportsPerformance) {
    performance.mark(markName(s));
  }
}

export function endMark(nodeName: string) {
  if (supportsPerformance) {
    const name = markName(nodeName);
    const start = `${name}_diff`;
    const end = `${name}_diffed`;
    try {
      performance.mark(end);
      performance.measure(name, start, end);

      performance.clearMarks(start);
      performance.clearMarks(end);
    } catch (e) {
      // Do nothing
    }
  }
}
