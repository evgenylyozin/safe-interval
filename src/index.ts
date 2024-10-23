/**
 * Function to manage the execution of a given function at specified intervals, ensuring each invocation completes before the next one starts.
 * @returns A function that, when called, stops the interval from executing further.
 * Main points of the safe interval are:
 * - no interleaving or shuffling of the callable invocations (like if an async function was not finished yet but the next one is already called and finished before the first one)
 * - only one interval for the same callable
 * - predictable clear interval
 */
export const CreateSafeInterval = (() => {
  // to track all functions that are called in the safe interval
  const FunctionsToClear: Map<
    (...args: unknown[]) => void,
    (() => void) | undefined
  > = new Map();
  /**
   * Start a new safe interval for the provided function.
   * @param callable Function to be called at each interval.
   * @param timeout Interval in milliseconds.
   * @param callableArgs Arguments for the function.
   */
  const startNewSafeInterval = (
    callable: (...args: unknown[]) => void,
    timeout: number | undefined,
    callableArgs: unknown[],
  ) => {
    (function loop() {
      const TimeoutID = setTimeout(async () => {
        // wait till the function is fully executed
        await callable(...callableArgs);
        // and repeat if the callable is still available
        if (FunctionsToClear.has(callable)) {
          loop();
        }
      }, timeout);
      FunctionsToClear.set(callable, () => {
        clearTimeout(TimeoutID);
      });
    })();
  };
  /**
   * Register a function and its corresponding clear function (the clear function here is set to undefined, the actual destroy or register callbacks are set elsewhere).
   * @param callable Function to be called at each interval.
   */
  const registerFunction = (callable: (...args: unknown[]) => void) => {
    FunctionsToClear.set(callable, undefined);
  };

  const destroySafeInterval = (callable: (...args: unknown[]) => void) => {
    if (FunctionsToClear.has(callable)) {
      const Clear = FunctionsToClear.get(callable);
      if (Clear) {
        Clear();
      }
      FunctionsToClear.delete(callable);
    }
  };
  /**
   * Creates a register callback that sets up a safe interval for the given callable function.
   * The callback, when invoked, registers the function and starts a new interval for it.
   * @param callable Function to be executed at each interval.
   * @param timeout Interval duration in milliseconds.
   * @param callableArgs Additional arguments for the callable function.
   * @returns A function that, when called, registers and initiates the interval.
   */
  const registerCallable = (
    callable: (...args: unknown[]) => void,
    timeout: number | undefined,
    callableArgs: unknown[],
  ): void => {
    destroySafeInterval(callable);
    registerFunction(callable);
    startNewSafeInterval(callable, timeout, callableArgs);
  };

  /**
   * Main function to create and manage safe intervals for a given function.
   * @param callable Function to be called at each interval.
   * @param timeout Interval in milliseconds.
   * @param callableArgs Arguments for the function.
   * @returns A function that, when called, stops the interval from executing further.
   */
  return (
    callable: (...args: unknown[]) => void,
    timeout: number | undefined,
    callableArgs: unknown[],
  ): (() => void) => {
    registerCallable(callable, timeout, callableArgs);
    // in any case return the destroy callback setter
    // which will on invocation set the destroy callback in the map
    // for the callable
    // the destroy callback if present will be called after the next callable call
    // on the currently active interval
    // and completely stop the interval and remove the callable from the map
    return () => {
      destroySafeInterval(callable);
    };
  };
})();

/**
 * Use this function if there is a need to setup multiple intervals for the same callable.
 * For example, if there is a need to fetch multiple different resources periodically, or the same resource but with different timeouts.
 * Every call to the function creates a new interval
 * characteristics which remain from standard CreateSafeInterval:
 * - no interleaving or shuffling of the callable invocations (inside the same interval)
 * - predictable clear interval
 * not like standard CreateSafeInterval:
 * - creates interval for the same callable each time allowing for not related intervals calling the same callable (no matter the arguments, timeout)
 */
export const CreateSafeIntervalMultiple = (
  callable: (...args: unknown[]) => void,
  timeout: number | undefined,
  callableArgs: unknown[],
) => {
  // to track single function that is called in the safe interval
  let Clear: (() => void) | undefined = undefined;
  /**
   * Start a new safe interval for the provided function.
   * @param callable Function to be called at each interval.
   * @param timeout Interval in milliseconds.
   * @param callableArgs Arguments for the function.
   */
  const startNewSafeInterval = (
    callable: (...args: unknown[]) => void,
    timeout: number | undefined,
    callableArgs: unknown[],
  ) => {
    (function loop() {
      const TimeoutID = setTimeout(async () => {
        // wait till the function is fully executed
        await callable(...callableArgs);
        // and repeat
        loop();
      }, timeout);
      Clear = () => {
        clearTimeout(TimeoutID);
      };
    })();
  };

  startNewSafeInterval(callable, timeout, callableArgs);

  return Clear;
};

export const CreateSafeTimeout = (() => {
  // to track all functions that are called in the safe timeout
  const FunctionsToClear: Map<
    (...args: unknown[]) => void,
    (() => void) | undefined
  > = new Map();

  // resolve queue
  const FunctionsToQueue: Map<
    (...args: unknown[]) => void,
    (() => Promise<void>)[]
  > = new Map();
  // loop track
  const FunctionsToLoop: Map<(...args: unknown[]) => void, boolean> = new Map();
  /**
   * Start a new safe timeout for the provided function.
   * @param callable Function to be called at the timeout.
   * @param timeout Timeout in milliseconds.
   * @param callableArgs Arguments for the function.
   */
  const startNewSafeTimeout = (
    callable: (...args: unknown[]) => void,
    timeout: number | undefined,
    callableArgs: unknown[],
  ) => {
    const TimeoutID = setTimeout(async () => {
      // push the function into the queue
      // if the callable is scheduler by the timeout (not cancelled)
      if (FunctionsToQueue.has(callable)) {
        FunctionsToQueue.get(callable).push(async () => {
          await callable(...callableArgs);
        });
        startNewTimeoutLoopIfNeeded(callable);
      }
    }, timeout);
    FunctionsToClear.set(callable, () => {
      clearTimeout(TimeoutID);
    });
  };

  /**
   * Register a function and its corresponding "Register callback" function (the function here is set to undefined, the actual register callback is set elsewhere).
   * @param callable Function to be called at the timeout expiration.
   */
  const registerFunction = (callable: (...args: unknown[]) => void) => {
    FunctionsToClear.set(callable, undefined);
    if (!FunctionsToQueue.has(callable)) FunctionsToQueue.set(callable, []);
    if (!FunctionsToLoop.has(callable)) FunctionsToLoop.set(callable, false);
  };

  const destroySafeInterval = (callable: (...args: unknown[]) => void) => {
    if (FunctionsToClear.has(callable)) {
      const Clear = FunctionsToClear.get(callable);
      if (Clear) {
        Clear();
      }
      FunctionsToClear.delete(callable);
    }
  };
  const startNewTimeoutLoopIfNeeded = (
    callable: (...args: unknown[]) => void,
  ) => {
    if (!FunctionsToLoop.get(callable)) {
      FunctionsToLoop.set(callable, true);
      (async function loop() {
        const queue = FunctionsToQueue.get(callable);
        if (queue.length > 0) {
          const callable = queue.shift();
          if (callable) {
            await callable();
            loop();
          }
        } else {
          FunctionsToLoop.set(callable, false);
        }
      })();
    }
  };
  /**
   * Creates a register callback that sets up a safe interval for the given callable function.
   * The callback, when invoked, registers the function and starts a new interval for it.
   * @param callable Function to be executed at each interval.
   * @param timeout Interval duration in milliseconds.
   * @param callableArgs Additional arguments for the callable function.
   * @returns A function that, when called, registers and initiates the interval.
   */
  const registerCallable = (
    callable: (...args: unknown[]) => void,
    timeout: number | undefined,
    callableArgs: unknown[],
  ): void => {
    destroySafeInterval(callable);
    registerFunction(callable);
    startNewSafeTimeout(callable, timeout, callableArgs);
  };
  return (
    callable: (...args: unknown[]) => void,
    timeout: number | undefined,
    callableArgs: unknown[],
  ): (() => void) => {
    registerCallable(callable, timeout, callableArgs);
    // in any case return the destroy callback setter
    // which will on invocation set the destroy callback in the map
    // for the callable
    // the destroy callback if present will be called after the next callable call
    // on the currently active interval
    // and completely stop the interval and remove the callable from the map
    return () => {
      destroySafeInterval(callable);
    };
  };
})();
