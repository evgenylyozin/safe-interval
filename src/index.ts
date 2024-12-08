// the function which is registered to be called after the timeout or periodically
type Callable = (...args: unknown[]) => unknown;
// the function which is returned after registering a new interval or timeout to remove such interval or timeout
type Clear = () => void;
// a map of callable to clear function
type FunctionToClear = WeakMap<Callable, Clear>;
// a map of callable to its queue of unresolved async functions (which are essentially the wrappers around the callable)
type FunctionToQueue = WeakMap<Callable, (() => Promise<unknown>)[]>;
// a map of callable to resolve loop status
type FunctionToLoop = WeakMap<Callable, boolean>;

// a possible callback to work with the result of a callable invocation
type Callback<T extends Callable> = (
  callableReturn: Awaited<ReturnType<T>>,
) => unknown;
// a map of callable to its callback
type FunctionToCallback = WeakMap<Callable, Callback<Callable> | undefined>;

// type of the cache of all maps
type Cache = {
  ftc: FunctionToClear;
  ftcb: FunctionToCallback;
  ftq: FunctionToQueue;
  ftl: FunctionToLoop;
};

/**
 * Destroys a timeout or interval by calling its clear function and removing callable from the FunctionToClear map.
 * @param callable The callable function which is registered to be called after the timeout or periodically
 * @param ftc The map of callable to clear function
 * currently there is no valid place to remove keys from
 * ftq, ftl, ftcb so that the pending invocations are resolved properly
 * if any memory related issues arise in the future, it might be
 * viable to create the means to track full callable completion and no reregistration
 * and then removing all the callable keys from all the maps
 * For now WeakMap is used which can potentially alleviate memory issues
 */
const destroy = (callable: Callable, ftc: FunctionToClear) => {
  // removing only the timeout or interval, not queue or loop or callback so that all the
  // pending invocations of the callable are resolved
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
const setQueue = (callable: Callable, ftq: FunctionToQueue) => {
  // is set only if not available already to not overwrite previous queue
  if (!ftq.has(callable)) ftq.set(callable, []);
};

/**
 * Initializes the resolve loop status for a callable.
 * @param callable The callable function which is registered to be called after the timeout or periodically
 * @param ftl The map of callable to resolve loop status
 */
const setLoop = (callable: Callable, ftl: FunctionToLoop) => {
  // is set only if not available already to not overwrite previous status of the loop
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
  // is set always on register to use the latest available cb for the callable resolved result
  ftcb.set(callable, cb);
};

/**
 * Starts a new resolve loop for the given callable only if the callable is registered in the FunctionToLoop map
 * and it is not already started.
 * The loop calls the first callable from the queue if any.
 * If the queue is empty the loop ends.
 * @param callable The callable to start the loop for (the original callable, not the wrapped one).
 * The resolve loop solves the main problem:
 * no shuffling of the callable invocations and resolved results even in the special case:
 * When the interval or timeout schedules the callable to be executed (already adds it to the stack) but the same callable
 * is then registered and resolves faster than the first one.
 */
const StartResolveLoopIfNeeded = (callable: Callable, cache: Cache) => {
  const { ftl, ftq, ftcb } = cache;
  // start the new loop only if the callable is registered in the FunctionToLoop map
  // and it is not already started
  if (ftl.has(callable) && !ftl.get(callable)) {
    // set the resolve loop status
    ftl.set(callable, true);

    // start the resolve loop
    (async function loop() {
      // get the current queue
      const queue = ftq.get(callable);
      // if the queue is not empty
      if (queue && queue.length > 0) {
        // get the first callable from the queue
        const wrappedCallable = queue.shift();
        if (wrappedCallable) {
          // call the wrapped callable awaiting for the resolve
          const r = await wrappedCallable();
          // call the cb if provided
          if (ftcb.has(callable)) {
            const cb = ftcb.get(callable);
            if (cb) cb(r);
          }
          // and repeat the loop
          loop();
        }
      } else {
        // here we know that the queue is empty
        // so we set the loop to not active state
        // specifically not removing ftl or ftq key here so that
        // an interval if any sees where to put new
        // wrapped callable (or else it will not push to the queue)
        ftl.set(callable, false);
      }
    })();
  }
};

/**
 * Start a new safe interval or timeout for the provided function.
 * @param callable Function to be called at each interval.
 * @param timeout Interval in milliseconds.
 * @param callableArgs Arguments for the function.
 * @param interval If true, an interval is created.
 * @param cache The cache object.
 */
const Start = <T extends Callable>(
  callable: T,
  timeout: number | undefined,
  callableArgs: Parameters<T>,
  interval: boolean,
  cache: Cache,
) => {
  const { ftc, ftq } = cache;
  const TimeoutCallback = () => {
    // push the function into the queue
    // if the callable is scheduled after the timeout passes (not cancelled)
    // the FunctionToQueue map should already have the callable as the registered key
    if (ftq.has(callable)) {
      // push the callable wrapped in an async function
      // to then call and resolve it in the order of the queue
      // the actual call is made by the resolve loop
      ftq.get(callable)!.push(async () => {
        return await callable(...callableArgs);
      });
      // after the push try to initiate the new loop
      // if not already started
      StartResolveLoopIfNeeded(callable, cache);
    }
  };
  const TimeoutID = interval
    ? setInterval(TimeoutCallback, timeout)
    : setTimeout(TimeoutCallback, timeout);
  // refresh the clear function to clear currently set timeout or interval
  ftc.set(callable, () => {
    clearTimeout(TimeoutID);
  });
};

/**
 * Register function that sets up a safe interval or timeout for the given callable function.
 * When invoked, destroys the previous interval or timeout and starts a new one for the provided callable.
 * @param callable Function to be executed at each interval.
 * @param timeout Interval duration in milliseconds.
 * @param callableArgs Additional arguments for the callable function.
 * @param interval If true, an interval is created.
 * @param cache The cache object.
 * @param cb Optional callback function to be called with the result of the callable function.
 */
const Register = <T extends Callable>(
  callable: T,
  timeout: number | undefined,
  callableArgs: Parameters<T>,
  interval: boolean,
  cache: Cache,
  cb?: Callback<T>,
): void => {
  const { ftc, ftq, ftl, ftcb } = cache;
  destroy(callable, ftc);
  setCallback(callable, cb, ftcb);
  setQueue(callable, ftq);
  setLoop(callable, ftl);
  Start(callable, timeout, callableArgs, interval, cache);
};

/**
 * Creates the maps to store the information about the registered functions.
 * This information consists of the following:
 * - `ftc`: The map of functions to their clear functions. This is used to destroy the previous interval or timeout when a new one is registered.
 * - `ftq`: The map of functions to their queues. This is used to track the queue of wrapped callables to resolve them in the correct order.
 * - `ftl`: The map of functions to their loop status. This is used to track the status of the loop of each function.
 * - `ftcb`: The map of functions to their callbacks. This is used to track the callbacks of each function.
 * @returns The object with the four maps.
 */
const CreateMaps = () => {
  // to track all functions that are called in the safe interval
  const ftc: FunctionToClear = new WeakMap();
  // resolve queue
  const ftq: FunctionToQueue = new WeakMap();
  // track loop status
  const ftl: FunctionToLoop = new WeakMap();
  // to track callbacks
  const ftcb: FunctionToCallback = new WeakMap();
  return { ftc, ftq, ftl, ftcb };
};
/**
 * Function to manage the execution of a given function at specified intervals, ensuring each invocation completes (resolves) before the next one starts.
 * @returns A function that, when called, stops the interval or timeout from executing further.
 * Main points of the safe interval or timeout are:
 * - no shuffling of the callable invocations and resolved results (like if an async function was not finished yet but the next one is already called and finished before the first one)
 * - only one interval or timeout for the same callable
 * - predictable clear function (if the interval or timeout is cleared before the callable added to the stack then no call will be made, if it was added already - the results will be in the predictable order)
 * - no way to create both interval and timeout for the same callable
 * - ability to reregister the callback function (then all unresolved calls from the queue will use the last registered callback for their results)
 * - ability to reregister the callable arguments and timeout which leads to resolving with the new arguments and after the new timeout if the callable wasn't pushed to the queue already
 * Can accept a callback function which is expecting the result of the callable as its argument
 * if the callback is provided then it is going to be called after the callable resolves
 * in case of the interval => the callback is called many times
 * the callback function is used to work with the results of the callable invocations to avoid the need to reference the callback in the callable itself
 */
export const CreateSafe = (() => {
  const cache = CreateMaps();
  /**
   * Main function to create and manage safe intervals or timeouts for a given function.
   * @param callable Function to be called at each interval or timeout.
   * @param timeout Interval/timeout duration in milliseconds.
   * @param callableArgs Arguments for the function.
   * @param interval If true, an interval is created.
   * @param cb Optional callback function to be called with the result of the callable function.
   * @returns A function that, when called, stops the interval from executing further.
   */
  return <T extends Callable>(
    callable: T,
    timeout: number | undefined,
    callableArgs: Parameters<T>,
    interval: boolean,
    cb?: Callback<T>,
  ): (() => void) => {
    Register(callable, timeout, callableArgs, interval, cache, cb);
    // return the function to destroy the interval
    return () => {
      destroy(callable, cache.ftc);
    };
  };
})();

/**
 * Use this function if there is a need to setup multiple intervals/timeouts for the same callable.
 * For example, if there is a need to fetch multiple different resources periodically, or the same resource but with different timeouts.
 * Every call to the function creates a new interval/timeout for the callable.
 * characteristics which remain from CreateSafe are:
 * - no shuffling of the callable invocations and resolved results (inside the same interval)
 * - predictable clear function
 * - can accept a callback
 * not like CreateSafe:
 * - creates interval/timeout for the same callable each time allowing for not related intervals/timeouts calling the same callable (no matter the arguments, timeout)
 * there is no closure over the cache here so
 * each call creates a new cache and the calls are not related through the cache or by any other means
 */
export const CreateSafeMultiple = <T extends Callable>(
  callable: T,
  timeout: number | undefined,
  callableArgs: Parameters<T>,
  interval: boolean,
  cb?: Callback<T>,
) => {
  const cache = CreateMaps();
  Register(callable, timeout, callableArgs, interval, cache, cb);
  // return the function to destroy the interval
  return () => {
    destroy(callable, cache.ftc);
  };
};
