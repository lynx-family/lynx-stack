/**
 * @template T
 */
export class Deferred {
  promise: Promise<any>;
  resolve: any;
  reject: any;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
