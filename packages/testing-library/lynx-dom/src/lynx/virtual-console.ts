import { EventEmitter } from 'events';

export class VirtualConsole extends EventEmitter {
  constructor() {
    super();

    this.on('error', () => {
      // If "error" event has no listeners,
      // EventEmitter throws an exception
    });
  }

  sendTo(anyConsole: Console, options: {
    omitJSDOMErrors?: boolean;
  } = {}) {
    if (options === undefined) {
      options = {};
    }

    for (const method of Object.keys(anyConsole)) {
      // @ts-ignore
      if (typeof anyConsole[method] === 'function') {
        // @ts-ignore
        function onMethodCall(...args) {
          // @ts-ignore
          anyConsole[method](...args);
        }
        this.on(method, onMethodCall);
      }
    }

    if (!options.omitJSDOMErrors) {
      this.on('jsdomError', e => anyConsole.error(e.stack, e.detail));
    }

    return this;
  }
}
