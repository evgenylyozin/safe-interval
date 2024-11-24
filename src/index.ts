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
// the cache of all maps
type Cache = {
  ftc: FunctionToClear;
  ftcb: FunctionToCallback;
  ftq: FunctionToQueue;
  ftl: FunctionToLoop;
};
const destroy = (callable: Callable, ftc: FunctionToClear) => {
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
  ftcb.set(callable, cb);
};

/**
 * Starts a new resolve loop for the given callable only if the callable is registered in the FunctionToLoop map
 * and it is not already started.
 * The loop calls the first callable from the queue if any.
 * If the queue is empty the loop destroys the keys in FunctionToLoop and FunctionToQueue and ends.
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
          if (ftcb.has(callable) && ftcb.get(callable)) {
            ftcb.get(callable)(r);
          }
          // and repeat the loop
          loop();
        }
      } else {
        // here we know that the queue is empty
        // so we set the loop to not active state
        // specifically not removing ftl or ftq key here so that
        // if an interval is created it sees where to put new
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
  // refresh the clear function to clear currently set timeout
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
 * @param cb Optional callback function to be called with the result of the callable function.
 */
const Register = <T extends Callable>(
  callable: T,
  timeout: number | undefined,
  callableArgs: Parameters<T>,
  interval: boolean,
  cache?: Cache,
  cb?: Callback<T>,
): void => {
  const { ftc, ftq, ftl, ftcb } = cache;
  destroy(callable, ftc);
  setCallback(callable, cb, ftcb);
  setQueue(callable, ftq);
  setLoop(callable, ftl);
  Start(callable, timeout, callableArgs, interval, cache);
};

const CreateMaps = () => {
  // to track all functions that are called in the safe interval
  const ftc: FunctionToClear = new Map();
  // resolve queue
  const ftq: FunctionToQueue = new Map();
  // track loop status
  const ftl: FunctionToLoop = new Map();
  // to track callbacks
  const ftcb: FunctionToCallback = new Map();
  return { ftc, ftq, ftl, ftcb };
};
/**
 * Function to manage the execution of a given function at specified intervals, ensuring each invocation completes (resolves) before the next one starts.
 * @returns A function that, when called, stops the interval from executing further.
 * Main points of the safe interval are:
 * - no shuffling of the callable invocations and resolved results (like if an async function was not finished yet but the next one is already called and finished before the first one)
 * - only one interval for the same callable
 * - predictable clear interval (if the interval is cleared before the callable added to the stack then no call will be made, if it was added already - the result will be in the predictable order)
 * - NO WAY TO CREATE INTERVAL AND TIMEOUT FOR THE SAME CALLABLE
 * Can accept a callback function which is expecting the result of the callable as its argument
 * if the callback is provided then it is going to be called after the callable resolves
 * in case of the interval => the callback is called many times
 * the callback function can be used to work with the results of the callable invocations
 */
export const CreateSafe = (() => {
  const cache = CreateMaps();
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
 * Use this function if there is a need to setup multiple intervals for the same callable.
 * For example, if there is a need to fetch multiple different resources periodically, or the same resource but with different timeouts.
 * Every call to the function creates a new interval
 * characteristics which remain from CreateSafeInterval:
 * - no shuffling of the callable invocations and resolved results (inside the same interval)
 * - predictable clear interval
 * not like CreateSafeInterval:
 * - creates interval for the same callable each time allowing for not related intervals calling the same callable (no matter the arguments, timeout)
 * ONLY DIFFERENCE FROM CREATESAFE IS THAT THERE IS NO CLOSURE HERE OVER THE CACHE
 * SO EACH CALL CREATES A NEW CACHE AND THE CALLS ARE NOT RELATED
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

/**
 * This is mainly just a wrapper for setTimeout, returning a function that clears the timeout
 * The difference is only in the callback which could be provided to
 * work with the result of the callable invocation
 * Use this function if there is a need to setup multiple timeouts for the same callable.
 * For example, if there is a need to fetch multiple different resources once per timeout, or the same resource but with different timeouts.
 * Every call to the function creates a new timeout not related to any other timeouts
 */
