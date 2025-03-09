import {
  getWindowFromNode,
  getDocument,
  jestFakeTimersAreEnabled,
  // We import these from the helpers rather than using the global version
  // because these will be *real* timers, regardless of whether we're in
  // an environment that's faked the timers out.
  checkContainerType,
} from './helpers';
import { getConfig, runWithExpensiveErrorDiagnosticsDisabled } from './config';

// This is so the stack trace the developer sees is one that's
// closer to their code (because async stack traces are hard to follow).
function copyStackTrace(target, source) {
  target.stack = source.stack.replace(source.message, target.message);
}

function waitFor(
  callback,
  {
    container = getDocument(),
    timeout = getConfig().asyncUtilTimeout,
    showOriginalStackTrace = getConfig().showOriginalStackTrace,
    stackTraceError,
    interval = 50,
    onTimeout = error => {
      Object.defineProperty(error, 'message', {
        value: getConfig().getElementError(error.message, container).message,
      });
      return error;
    },
  },
) {
  if (typeof callback !== 'function') {
    throw new TypeError('Received `callback` arg must be a function');
  }

  return new Promise(async (resolve, reject) => {
    let lastError, intervalId;
    let promiseStatus = 'idle';

    const overallTimeoutTimer = setTimeout(handleTimeout, timeout);

    try {
      checkContainerType(container);
    } catch (e) {
      reject(e);
      return;
    }
    // eslint-disable-next-line prefer-const
    intervalId = setInterval(checkRealTimersCallback, interval);
    // const {MutationObserver} = getWindowFromNode(container)
    // observer = new MutationObserver(checkRealTimersCallback)
    // observer.observe(container, mutationObserverOptions)
    checkCallback();

    function onDone(error, result) {
      clearTimeout(overallTimeoutTimer);
      clearInterval(intervalId);

      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    }

    function checkRealTimersCallback() {
      return checkCallback();
    }

    function checkCallback() {
      if (promiseStatus === 'pending') return;
      try {
        const result = runWithExpensiveErrorDiagnosticsDisabled(callback);
        if (typeof result?.then === 'function') {
          promiseStatus = 'pending';
          result.then(
            resolvedValue => {
              promiseStatus = 'resolved';
              onDone(null, resolvedValue);
            },
            rejectedValue => {
              promiseStatus = 'rejected';
              lastError = rejectedValue;
            },
          );
        } else {
          onDone(null, result);
        }
        // If `callback` throws, wait for the next mutation, interval, or timeout.
      } catch (error) {
        // Save the most recent callback error to reject the promise with it in the event of a timeout
        lastError = error;
      }
    }

    function handleTimeout() {
      let error;
      if (lastError) {
        error = lastError;
        if (
          !showOriginalStackTrace
          && error.name === 'TestingLibraryElementError'
        ) {
          copyStackTrace(error, stackTraceError);
        }
      } else {
        error = new Error('Timed out in waitFor.');
        if (!showOriginalStackTrace) {
          copyStackTrace(error, stackTraceError);
        }
      }
      onDone(onTimeout(error), null);
    }
  });
}

function waitForWrapper(callback, options) {
  // create the error here so its stack trace is as close to the
  // calling code as possible
  const stackTraceError = new Error('STACK_TRACE_MESSAGE');
  return getConfig().asyncWrapper(() =>
    waitFor(callback, { stackTraceError, ...options })
  );
}

export { waitForWrapper as waitFor };

/*
eslint
  max-lines-per-function: ["error", {"max": 200}],
*/
