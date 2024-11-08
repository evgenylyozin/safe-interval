// the function which is registered to be called after the timeout or periodically
type Callable = (...args: unknown[]) => void;
// the function which is returned after registering a new interval or timeout to remove such interval or timeout
type Clear = (() => void) | undefined;
// a map of callable to clear function
type FunctionsToClear = Map<Callable, Clear>;
// a map of callable to its queue of unresolved async functions (which are essentially the wrappers around the callable)
type FunctionsToQueue = Map<Callable, (() => Promise<void>)[]>;
// a map of callable to resolve loop status
type FunctionsToLoop = Map<Callable, boolean>;

/**
 * Destroys a timeout or interval by calling its clear function and removing callable from the FunctionsToClear map.
 * @param callable The callable function which is registered to be called after the timeout or periodically
 * @param ftc The map of callable to clear function
 */
const destroy = (callable: Callable, ftc: FunctionsToClear) => {
  if (ftc.has(callable)) {
    const Clear = ftc.get(callable);
    if (Clear) {
      Clear();
    }
    ftc.delete(callable);
  }
};

/**
 * Initializes the queue of unresolved async functions for a callable.
 * @param callable The callable function which is registered to be called after the timeout or periodically
 * @param ftq The map of callable to its queue of unresolved async functions (which are essentially the wrappers around the callable)
 */
const setQueue = (callable: Callable, ftq: FunctionsToQueue) => {
  if (!ftq.has(callable)) ftq.set(callable, []);
};

/**
 * Initializes the resolve loop status for a callable.
 * @param callable The callable function which is registered to be called after the timeout or periodically
 * @param ftl The map of callable to resolve loop status
 */
const setLoop = (callable: Callable, ftl: FunctionsToLoop) => {
  if (!ftl.has(callable)) ftl.set(callable, false);
};

/**
 * Function to manage the execution of a given function at specified intervals, ensuring each invocation completes (resolves) before the next one starts.
 * @returns A function that, when called, stops the interval from executing further.
 * Main points of the safe interval are:
 * - no shuffling of the callable invocations and resolved results (like if an async function was not finished yet but the next one is already called and finished before the first one)
 * - only one interval for the same callable
 * - predictable clear interval (if the interval is cleared before the callable added to the stack then no call will be made, if it was added already - the result will be in the predictable order)
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
      // on each loop refresh the clear function to clear currently set timeout
      FunctionsToClear.set(callable, () => {
        clearTimeout(TimeoutID);
      });
    })();
  };

  /**
   * Register function that sets up a safe interval for the given callable function.
   * When invoked, destroys the previous interval and starts a new interval for the provided callable.
   * @param callable Function to be executed at each interval.
   * @param timeout Interval duration in milliseconds.
   * @param callableArgs Additional arguments for the callable function.
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
    // return the function to destroy the interval
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
 * - no shuffling of the callable invocations and resolved results (inside the same interval)
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
      // on each loop refresh the clear function to clear currently set timeout
      Clear = () => {
        clearTimeout(TimeoutID);
      };
    })();
  };

  // start the new interval immediately
  // since there is no need to destroy the previous one
  // each interval with CreateSafeIntervalMultiple is independent
  startNewSafeInterval(callable, timeout, callableArgs);

  // return the function to destroy the interval
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
      // if the callable is scheduled after the timeout passes (not cancelled)
      // the FunctionsToQueue map should already have the callable as the registered key
      if (FunctionsToQueue.has(callable)) {
        // push the callable wrapped in an async function
        // to then call and resolve it in the order of the queue
        // the actual call is made by the resolve loop
        FunctionsToQueue.get(callable)!.push(async () => {
          await callable(...callableArgs);
        });
        // after the push try to initiate the new loop
        // if not already started
        startResolveLoopIfNeeded(callable);
      }
    }, timeout);
    // refresh the clear function to clear currently set timeout
    FunctionsToClear.set(callable, () => {
      clearTimeout(TimeoutID);
    });
  };

  /**
   * Starts a new resolve loop for the given callable only if the callable is registered in the FunctionsToLoop map
   * and it is not already started.
   * The loop calls the first callable from the queue if any.
   * If the queue is empty the loop destroys the keys in FunctionsToLoop and FunctionsToQueue and ends.
   * @param callable The callable to start the loop for.
   */
  const startResolveLoopIfNeeded = (callable: Callable) => {
    // start the new loop only if the callable is registered in the FunctionsToLoop map
    // and it is not already started
    if (FunctionsToLoop.has(callable) && !FunctionsToLoop.get(callable)) {
      // set the resolve loop status
      FunctionsToLoop.set(callable, true);

      // start the resolve loop
      (async function loop() {
        // get the current queue
        const queue = FunctionsToQueue.get(callable);
        // if the queue is not empty
        if (queue && queue.length > 0) {
          // get the first callable from the queue
          const callable = queue.shift();
          if (callable) {
            // call the callable awaiting for the resolve
            await callable();
            // and repeat the loop
            loop();
          }
        } else {
          // here we know that the queue is empty
          // so we can destroy the keys in FunctionsToLoop and FunctionsToQueue
          FunctionsToLoop.delete(callable);
          FunctionsToQueue.delete(callable);
        }
      })();
    }
  };

  /**
   * Register function that sets up a safe timeout for the given callable function.
   * When invoked,destroys the previous safe timeout and if needed sets the Queue and the Loop status for the callable
   * and starts a new timeout for the callable.
   * @param callable Function to be executed after the timeout.
   * @param timeout Timeout duration in milliseconds.
   * @param callableArgs Additional arguments for the callable.
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

  /**
   * Main function to create and manage safe timeouts for a given function.
   * @param callable Function to be called at the timeout.
   * @param timeout Timeout in milliseconds.
   * @param callableArgs Arguments for the function.
   * @returns A function that, when called, stops the timeout.
   */
  return (
    callable: Callable,
    timeout: number | undefined,
    callableArgs: unknown[],
  ): (() => void) => {
    registerCallable(callable, timeout, callableArgs);
    // return the function to destroy the timeout
    return () => {
      destroy(callable, FunctionsToClear);
    };
  };
})();

/**
 * This is just a wrapper for setTimeout, returning a function that clears the timeout
 * Just for convenience
 * The default setTimeout can be used instead
 *
 * Use this function if there is a need to setup multiple timeouts for the same callable.
 * For example, if there is a need to fetch multiple different resources once per timeout, or the same resource but with different timeouts.
 * Every call to the function creates a new timeout not related to any other timeouts
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
