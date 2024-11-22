// the function which is registered to be called after the timeout or periodically
type Callable = (...args: unknown[]) => unknown;
// the function which is returned after registering a new interval or timeout to remove such interval or timeout
type Clear = (() => void) | undefined;
// a map of callable to clear function
type FunctionToClear = Map<Callable, Clear>;
// a map of callable to its queue of unresolved async functions (which are essentially the wrappers around the callable)
type FunctionToQueue = Map<Callable, (() => Promise<unknown>)[]>;
// a map of callable to resolve loop status
type FunctionToLoop = Map<Callable, boolean>;

// a possible callback to work with the result of a callable invocation
type Callback<T extends Callable> = (
  callableReturn: Awaited<ReturnType<T>>,
) => unknown;
// a map of callable to its callback
type FunctionToCallback = Map<Callable, Callback<Callable>>;
/**
 * Destroys a timeout or interval by calling its clear function and removing callable from the FunctionToClear map.
 * @param callable The callable function which is registered to be called after the timeout or periodically
 * @param ftc The map of callable to clear function
 */
const destroy = (
  callable: Callable,
  ftc: FunctionToClear,
  ftcb: FunctionToCallback,
) => {
  if (ftc.has(callable)) {
    const Clear = ftc.get(callable);
    if (Clear) {
      Clear();
    }
    ftc.delete(callable);
  }
  // destroy the callback
  if (ftcb && ftcb.has(callable)) {
    ftcb.delete(callable);
  }
};

/**
 * Initializes the queue of unresolved async functions for a callable.
 * @param callable The callable function which is registered to be called after the timeout or periodically
 * @param ftq The map of callable to its queue of unresolved async functions (which are essentially the wrappers around the callable)
 */
const setQueue = (callable: Callable, ftq: FunctionToQueue) => {
  if (!ftq.has(callable)) ftq.set(callable, []);
};

/**
 * Initializes the resolve loop status for a callable.
 * @param callable The callable function which is registered to be called after the timeout or periodically
 * @param ftl The map of callable to resolve loop status
 */
const setLoop = (callable: Callable, ftl: FunctionToLoop) => {
  if (!ftl.has(callable)) ftl.set(callable, false);
};

/**
 * Initializes the callback for a callable.
 * @param callable The callable function which is registered to be called after the timeout or periodically
 * @param cb The callback to be called with the result of the callable invocation
 * @param ftcb The map of callable to its callback
 */
const setCallback = <T extends Callable>(
  callable: T,
  cb: Callback<T> | undefined,
  ftcb: FunctionToCallback,
) => {
  if (!ftcb.has(callable) && cb) {
    ftcb.set(callable, cb);
  }
};

/**
 * Function to manage the execution of a given function at specified intervals, ensuring each invocation completes (resolves) before the next one starts.
 * @returns A function that, when called, stops the interval from executing further.
 * Main points of the safe interval are:
 * - no shuffling of the callable invocations and resolved results (like if an async function was not finished yet but the next one is already called and finished before the first one)
 * - only one interval for the same callable
 * - predictable clear interval (if the interval is cleared before the callable added to the stack then no call will be made, if it was added already - the result will be in the predictable order)
 * Can accept a callback function which is expecting the result of the callable as its argument
 * if the callback is provided then it is going to be called after the callable resolves
 * in case of the interval => the callback is called many times
 * the callback function can be used to work with the results of the callable invocations
 * @summary The results of safe interval for the same callable could potentially shuffle.
 * Specifically in cases when the interval schedules the callable to be executed (already adds it to the stack) but the same callable
 * is then registered with new safe interval.
 * Then there is a chance that the next call will finish earlier if the first one takes longer to resolve than new interval time+time to resolve of the second call.
 */
export const CreateSafeInterval = (() => {
  // to track all functions that are called in the safe interval
  const FunctionToClear: FunctionToClear = new Map();
  // to track the callbacks
  const FunctionToCallback: FunctionToCallback = new Map();
  /**
   * Start a new safe interval for the provided function.
   * Intentionally not extracting this one to something more general between all functions
   * In favor of readability and maintainability
   * @param callable Function to be called at each interval.
   * @param timeout Interval in milliseconds.
   * @param callableArgs Arguments for the function.
   */
  const startNewSafeInterval = <T extends Callable>(
    callable: T,
    timeout: number | undefined,
    callableArgs: Parameters<T>,
  ) => {
    (function loop() {
      const TimeoutID = setTimeout(async () => {
        // wait till the function is fully executed
        const r = await callable(...callableArgs);
        // call the cb if provided
        if (FunctionToCallback.has(callable)) {
          FunctionToCallback.get(callable)!(r);
        }
        // and repeat if the callable is still available
        if (FunctionToClear.has(callable)) {
          loop();
        }
      }, timeout);
      // on each loop refresh the clear function to clear currently set timeout
      FunctionToClear.set(callable, () => {
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
   * @param cb Optional callback function to be called with the result of the callable function.
   */
  const registerCallable = <T extends Callable>(
    callable: T,
    timeout: number | undefined,
    callableArgs: Parameters<T>,
    cb?: Callback<T>,
  ): void => {
    destroy(callable, FunctionToClear, FunctionToCallback);
    setCallback(callable, cb, FunctionToCallback);
    startNewSafeInterval(callable, timeout, callableArgs);
  };

  /**
   * Main function to create and manage safe intervals for a given function.
   * @param callable Function to be called at each interval.
   * @param timeout Interval in milliseconds.
   * @param callableArgs Arguments for the function.
   * @param cb Optional callback function to be called with the result of the callable function.
   * @returns A function that, when called, stops the interval from executing further.
   */
  return <T extends Callable>(
    callable: T,
    timeout: number | undefined,
    callableArgs: Parameters<T>,
    cb?: Callback<T>,
  ): (() => void) => {
    registerCallable(callable, timeout, callableArgs, cb);
    // return the function to destroy the interval
    return () => {
      destroy(callable, FunctionToClear, FunctionToCallback);
    };
  };
})();

/**
 * Use this function if there is a need to setup multiple intervals for the same callable.
 * For example, if there is a need to fetch multiple different resources periodically, or the same resource but with different timeouts.
 * Every call to the function creates a new interval
 * characteristics which remain from CreateSafeInterval:
 * - no shuffling of the callable invocations and resolved results (inside the same interval)
 * - predictable clear interval
 * not like CreateSafeInterval:
 * - creates interval for the same callable each time allowing for not related intervals calling the same callable (no matter the arguments, timeout)
 */
export const CreateSafeIntervalMultiple = <T extends Callable>(
  callable: T,
  timeout: number | undefined,
  callableArgs: Parameters<T>,
  cb?: Callback<T>,
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
    callable: T,
    timeout: number | undefined,
    callableArgs: Parameters<T>,
  ) => {
    (function loop() {
      const TimeoutID = setTimeout(async () => {
        // wait till the function is fully executed
        const r = (await callable(...callableArgs)) as Awaited<ReturnType<T>>;
        // call the cb if provided
        if (cb) {
          cb(r);
        }
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

/**
 * Function to manage the execution of a given function with specified timeout, ensuring single timeout for the same callable no matter the arguments.
 * @returns A function that, when called, clears the timeout.
 * Main points of the safe timeout are:
 * - only one timeout for the same callable
 * - predictable clear timeout (if the timeout is cleared before the callable added to the stack then no call will be made, if it was added already - the callable will be executed)
 * Can accept a callback function which is expecting the result of the callable as its argument
 * if the callback is provided then it is going to be called after the callable resolves
 * in case of the timeout => the callback is called 1 time
 * @summary The results of safe timeout for the same callable could potentially shuffle.
 * Specifically in cases when the timeout schedules the callable to be executed (already adds it to the stack) but the same callable
 * is then registered with new safe timeout.
 * Then there is a chance that the second call will finish earlier if the first one takes longer to resolve than new timeout+time to resolve of the second call.
 */
export const CreateSafeTimeout = (() => {
  // to track all functions that are called in the safe timeout
  const FunctionToClear: FunctionToClear = new Map();
  // resolve queue
  const FunctionToQueue: FunctionToQueue = new Map();
  // track loop status
  const FunctionToLoop: FunctionToLoop = new Map();
  // to track callbacks
  const FunctionToCallback: FunctionToCallback = new Map();
  /**
   * Start a new safe timeout for the provided function.
   * @param callable Function to be called at the timeout.
   * @param timeout Timeout in milliseconds.
   * @param callableArgs Arguments for the function.
   */
  const startNewSafeTimeout = <T extends Callable>(
    callable: T,
    timeout: number | undefined,
    callableArgs: Parameters<T>,
  ) => {
    const TimeoutID = setTimeout(() => {
      // push the function into the queue
      // if the callable is scheduled after the timeout passes (not cancelled)
      // the FunctionToQueue map should already have the callable as the registered key
      if (FunctionToQueue.has(callable)) {
        // push the callable wrapped in an async function
        // to then call and resolve it in the order of the queue
        // the actual call is made by the resolve loop
        FunctionToQueue.get(callable)!.push(async () => {
          return await callable(...callableArgs);
        });
        // after the push try to initiate the new loop
        // if not already started
        startResolveLoopIfNeeded(callable);
      }
    }, timeout);
    // refresh the clear function to clear currently set timeout
    FunctionToClear.set(callable, () => {
      clearTimeout(TimeoutID);
    });
  };

  /**
   * Starts a new resolve loop for the given callable only if the callable is registered in the FunctionToLoop map
   * and it is not already started.
   * The loop calls the first callable from the queue if any.
   * If the queue is empty the loop destroys the keys in FunctionToLoop and FunctionToQueue and ends.
   * @param callable The callable to start the loop for (the original callable, not the wrapped one).
   */
  const startResolveLoopIfNeeded = (callable: Callable) => {
    // start the new loop only if the callable is registered in the FunctionToLoop map
    // and it is not already started
    if (FunctionToLoop.has(callable) && !FunctionToLoop.get(callable)) {
      // set the resolve loop status
      FunctionToLoop.set(callable, true);

      // start the resolve loop
      (async function loop() {
        // get the current queue
        const queue = FunctionToQueue.get(callable);
        // if the queue is not empty
        if (queue && queue.length > 0) {
          // get the first callable from the queue
          const wrappedCallable = queue.shift();
          if (wrappedCallable) {
            // call the wrapped callable awaiting for the resolve
            const r = await wrappedCallable();
            // call the cb if provided
            if (FunctionToCallback.has(callable)) {
              FunctionToCallback.get(callable)!(r);
            }
            // and repeat the loop
            loop();
          }
        } else {
          // here we know that the queue is empty
          // so we can destroy the keys in FunctionToLoop and FunctionToQueue
          FunctionToLoop.delete(callable);
          FunctionToQueue.delete(callable);
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
   * @param cb Optional Callback to be executed after the callable resolves.
   */
  const registerCallable = <T extends Callable>(
    callable: T,
    timeout: number | undefined,
    callableArgs: Parameters<T>,
    cb?: Callback<T>,
  ): void => {
    destroy(callable, FunctionToClear, FunctionToCallback);
    setCallback(callable, cb, FunctionToCallback);
    setQueue(callable, FunctionToQueue);
    setLoop(callable, FunctionToLoop);
    startNewSafeTimeout(callable, timeout, callableArgs);
  };

  /**
   * Main function to create and manage safe timeouts for a given function.
   * @param callable Function to be called at the timeout.
   * @param timeout Timeout in milliseconds.
   * @param callableArgs Arguments for the function.
   * @param cb Optional callback function to be called with the result of the callable function.
   * @returns A function that, when called, stops the timeout.
   */
  return <T extends Callable>(
    callable: T,
    timeout: number | undefined,
    callableArgs: Parameters<T>,
    cb?: Callback<T>,
  ): (() => void) => {
    registerCallable(callable, timeout, callableArgs, cb);
    // return the function to destroy the timeout
    return () => {
      destroy(callable, FunctionToClear, FunctionToCallback);
    };
  };
})();

/**
 * This is mainly just a wrapper for setTimeout, returning a function that clears the timeout
 * The difference is only in the callback which could be provided to
 * work with the result of the callable invocation
 * Use this function if there is a need to setup multiple timeouts for the same callable.
 * For example, if there is a need to fetch multiple different resources once per timeout, or the same resource but with different timeouts.
 * Every call to the function creates a new timeout not related to any other timeouts
 */
export const CreateSafeTimeoutMultiple = <T extends Callable>(
  callable: T,
  timeout: number | undefined,
  callableArgs: Parameters<T>,
  cb?: Callback<T>,
) => {
  const Timeout = setTimeout(async () => {
    // wait till the function is fully executed
    const r = (await callable(...callableArgs)) as Awaited<ReturnType<T>>;
    // call the cb if provided
    if (cb) {
      cb(r);
    }
  }, timeout);
  return () => {
    clearTimeout(Timeout);
  };
};
