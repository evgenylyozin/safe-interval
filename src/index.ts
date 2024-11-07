type Callable = (...args: unknown[]) => void;
type Clear = (() => void) | undefined;
type FunctionsToClear = Map<Callable, Clear>;
type FunctionsToQueue = Map<Callable, (() => Promise<void>)[]>;
type FunctionsToLoop = Map<Callable, boolean>;

const destroy = (callable: Callable, ftc: FunctionsToClear) => {
  if (ftc.has(callable)) {
    const Clear = ftc.get(callable);
    if (Clear) {
      Clear();
    }
    ftc.delete(callable);
  }
};

const setQueue = (callable: Callable, ftq: FunctionsToQueue) => {
  if (!ftq.has(callable)) ftq.set(callable, []);
};
const setLoop = (callable: Callable, ftl: FunctionsToLoop) => {
  if (!ftl.has(callable)) ftl.set(callable, false);
};
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
  const FunctionsToClear: FunctionsToClear = new Map();
  /**
   * Start a new safe interval for the provided function.
   * Intentionally not extracting this one to something more general between all functions
   * In favor of readability and maintainability
   * @param callable Function to be called at each interval.
   * @param timeout Interval in milliseconds.
   * @param callableArgs Arguments for the function.
   */
  const startNewSafeInterval = (
    callable: Callable,
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
   * Creates a register callback that sets up a safe interval for the given callable function.
   * The callback, when invoked, registers the function and starts a new interval for it.
   * @param callable Function to be executed at each interval.
   * @param timeout Interval duration in milliseconds.
   * @param callableArgs Additional arguments for the callable function.
   * @returns A function that, when called, registers and initiates the interval.
   */
  const registerCallable = (
    callable: Callable,
    timeout: number | undefined,
    callableArgs: unknown[],
  ): void => {
    destroy(callable, FunctionsToClear);
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
    callable: Callable,
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
      destroy(callable, FunctionsToClear);
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
  callable: Callable,
  timeout: number | undefined,
  callableArgs: unknown[],
) => {
  // to track single function that is called in the safe interval
  let Clear: Clear = undefined;
  /**
   * Start a new safe interval for the provided function.
   * @param callable Function to be called at each interval.
   * @param timeout Interval in milliseconds.
   * @param callableArgs Arguments for the function.
   */
  const startNewSafeInterval = (
    callable: Callable,
    timeout: number | undefined,
    callableArgs: unknown[],
  ) => {
    (function loop() {
      const TimeoutID = setTimeout(async () => {
        // wait till the function is fully executed
        await callable(...callableArgs);
        // and repeat if not cleared
        if (Clear) {
          loop();
        }
      }, timeout);
      Clear = () => {
        clearTimeout(TimeoutID);
      };
    })();
  };

  startNewSafeInterval(callable, timeout, callableArgs);

  return () => {
    if (Clear) Clear();
    Clear = undefined;
  };
};

export const CreateSafeTimeout = (() => {
  // to track all functions that are called in the safe timeout
  const FunctionsToClear: FunctionsToClear = new Map();
  // resolve queue
  const FunctionsToQueue: FunctionsToQueue = new Map();
  // track loop status
  const FunctionsToLoop: FunctionsToLoop = new Map();

  /**
   * Start a new safe timeout for the provided function.
   * @param callable Function to be called at the timeout.
   * @param timeout Timeout in milliseconds.
   * @param callableArgs Arguments for the function.
   */
  const startNewSafeTimeout = (
    callable: Callable,
    timeout: number | undefined,
    callableArgs: unknown[],
  ) => {
    const TimeoutID = setTimeout(() => {
      // push the function into the queue
      // if the callable is scheduler by the timeout (not cancelled)
      if (FunctionsToQueue.has(callable)) {
        FunctionsToQueue.get(callable)!.push(async () => {
          await callable(...callableArgs);
        });
        startResolveLoopIfNeeded(callable);
      }
    }, timeout);
    FunctionsToClear.set(callable, () => {
      clearTimeout(TimeoutID);
    });
  };

  const startResolveLoopIfNeeded = (callable: Callable) => {
    if (FunctionsToLoop.has(callable) && !FunctionsToLoop.get(callable)) {
      FunctionsToLoop.set(callable, true);
      (async function loop() {
        const queue = FunctionsToQueue.get(callable);
        if (queue && queue.length > 0) {
          const callable = queue.shift();
          if (callable) {
            await callable();
            loop();
          }
        } else {
          // here we know that the queue is empty
          // so we could destroy the key in FunctionsToLoop and FunctionsToQueue
          FunctionsToLoop.delete(callable);
          FunctionsToQueue.delete(callable);
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
    callable: Callable,
    timeout: number | undefined,
    callableArgs: unknown[],
  ): void => {
    destroy(callable, FunctionsToClear);
    setQueue(callable, FunctionsToQueue);
    setLoop(callable, FunctionsToLoop);
    startNewSafeTimeout(callable, timeout, callableArgs);
  };
  return (
    callable: Callable,
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
      destroy(callable, FunctionsToClear);
    };
  };
})();

/**
 * This is just a wrapper for setTimeout, returning a function that clears the timeout
 * Just for convenience
 * The default setTimeout can be used instead
 * Use this function if there is a need to setup multiple timeouts for the same callable.
 * For example, if there is a need to fetch multiple different resources once per timeout, or the same resource but with different timeouts.
 * Every call to the function creates a new timeout
 */
export const CreateSafeTimeoutMultiple = (
  callable: Callable,
  timeout: number | undefined,
  callableArgs: unknown[],
) => {
  const Timeout = setTimeout(callable, timeout, ...callableArgs);
  return () => {
    clearTimeout(Timeout);
  };
};
