export interface PerformanceMetric {
  id: string;
  startTime: number;
  duration: number;
  type: 'component' | 'operation' | 'render';
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric[]>;
  private marks: Map<string, number>;

  private constructor() {
    this.metrics = new Map();
    this.marks = new Map();
  }

  static getInstance(): PerformanceMonitor {
    if (!this.instance) {
      this.instance = new PerformanceMonitor();
    }
    return this.instance;
  }

  startMeasure(id: string, type: PerformanceMetric['type']): void {
    this.marks.set(id, performance.now());
  }

  endMeasure(id: string, type: PerformanceMetric['type']): PerformanceMetric {
    const startTime = this.marks.get(id);
    if (!startTime) {
      throw new Error(`No start mark found for measurement: ${id}`);
    }

    const endTime = performance.now();
    const metric: PerformanceMetric = {
      id,
      startTime,
      duration: endTime - startTime,
      type,
    };

    const existingMetrics = this.metrics.get(id) || [];
    this.metrics.set(id, [...existingMetrics, metric]);

    return metric;
  }

  getMetrics(id?: string): PerformanceMetric[] {
    if (id) {
      return this.metrics.get(id) || [];
    }
    return Array.from(this.metrics.values()).flat();
  }

  clearMetrics(): void {
    this.metrics.clear();
    this.marks.clear();
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();
