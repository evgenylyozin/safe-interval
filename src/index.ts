/* eslint-disable @typescript-eslint/no-explicit-any */
//--TestsRelated--import { SpyOnCache } from "../test.helpers.js";

// the function which is registered to be called after the timeout or periodically
type Callable = (...args: any[]) => any;
// the function which is returned after registering a new interval or timeout to remove such interval or timeout
type Clear = () => void;
// a map of callable to clear function
type FunctionToClear = Map<Callable, Clear>;
// a map of callable to its queue of unresolved async functions (which are essentially the wrappers around the callable)
type FunctionToQueue = Map<Callable, (() => Promise<ReturnType<Callable>>)[]>;
// a map of callable to resolve loop status
type FunctionToLoop = Map<Callable, boolean>;

/**
 * a possible callback to work with the result of a callable invocation
 */
type Callback<T extends Callable> = (
  callableReturn: Awaited<ReturnType<T>>,
) => any;
// a map of callable to its callback
type FunctionToCallback = Map<Callable, Callback<Callable> | undefined>;

// type of the cache of all maps
export type Cache = {
  ftc: FunctionToClear;
  ftcb: FunctionToCallback;
  ftq: FunctionToQueue;
  ftl: FunctionToLoop;
};

/**
 * type for the create safe parameters
 */
type Params<T extends Callable> = {
  callable: T;
  callableArgs: Parameters<T>;
  isInterval?: boolean;
  timeout?: number;
  cb?: Callback<T>;
  removeQueue?: boolean;
};

/**
 * Destroys a timeout or interval by calling its clear function and removing callable from the FunctionToClear map.
 * @param callable The callable function which is registered to be called after the timeout or periodically
 * @param ftc The map of callable to clear function
 * @param withQueue If true, the queue of unresolved async functions for the callable is also removed
 * currently there is no valid place to remove keys from
 * ftq, ftl, ftcb so that the pending invocations are resolved properly
 * if any memory related issues arise in the future, it might be
 * viable to create the means to track full callable completion and no reregistration
 * and then removing all the callable keys from all the maps
 */
const destroy = (
  callable: Callable,
  cache: Cache,
  withQueue: boolean = false,
) => {
  // removing only the timeout or interval, not queue or loop or callback so that all the
  // pending invocations of the callable are resolved
  if (cache.ftc.has(callable)) {
    const Clear = cache.ftc.get(callable);
    if (Clear) {
      Clear();
    }
    cache.ftc.delete(callable);
  }
  // if the withQueue flag is true, then remove the queue for the callable too
  // remove it fully from the map to tell other code that the queue was cleared on purpose with clear function
  // or on reregister
  if (withQueue) {
    if (cache.ftq.has(callable)) {
      cache.ftq.delete(callable);
    }
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
  setLoop(callable, ftl); // if the key in ftl was removed by the previous loop, add it again
  // start the new loop only if the callable is registered in the FunctionToLoop map
  // and it is not already started
  if (!ftl.get(callable)) {
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
        // so remove the resolve loop status
        // and the queue
        // and the callback
        ftl.delete(callable);
        ftq.delete(callable);
        ftcb.delete(callable);
      }
    })();
  }
};

/**
 * Start a new safe interval or timeout for the provided function.
 * @param callable Function to be called at each interval.
 * @param timeout Interval in milliseconds.
 * @param callableArgs Arguments for the function.
 * @param isInterval If true, an interval is created.
 * @param cache The cache object.
 */
const Start = <T extends Callable>(
  callable: T,
  timeout: number | undefined,
  callableArgs: Parameters<T>,
  interval: boolean | undefined,
  cache: Cache,
) => {
  const { ftc, ftq, ftcb } = cache;
  const OriginalCB = ftcb.get(callable); // to not lose registered original cb get reference here
  // the timeout callback is made async
  // on purpose so that if the calling code
  // is clearing the timeout or interval with the withQueue flag
  // the first wrapped call to the callable is not pushed to the queue
  // and not resolved in spite of the clear function called
  // without the async callback here and awaiting below
  // the things would go as: synchronously: register new callable, push it to the queue, start the loop, start the await for the wrapped callable,
  // and only then clear the queue (hence the first call would be executed anyway)
  // with the async here the synchronous operations end on the register then if the clear was called it would empty the queue
  // before anything from the queue is set to be executed
  const TimeoutCallback = () => {
    setQueue(callable, ftq); // if the queue was removed by previous resolve loop then recreate it
    setCallback(callable, OriginalCB, ftcb); // if the cb was removed by previous resolve loop then recreate it
    // push the callable wrapped in an async function
    // to then call and resolve it in the order of the queue
    // the actual call is made by the resolve loop
    ftq.get(callable)!.push(async () => {
      return await callable(...callableArgs);
    });
    // after the push try to initiate the new loop
    // if not already started
    StartResolveLoopIfNeeded(callable, cache);
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
 * In cases where the passed in callable is anonymous
 * we can't just put it to the cache because
 * there could be the same callable (by value) already
 * which would lead to registering identical function multiple times
 * We go over all available callables here and if there is already the same callable
 * we return it or the originally registered callable is returned
 * @param c - The callable which is registered
 * @param ftc - The map of callables to their clear functions already available in the cache
 * @returns
 */
const FindSame = (c: Callable, ftc: FunctionToClear) => {
  if (ftc.has(c)) {
    // Found same by address
    return c;
  }
  for (const [key] of ftc) {
    if (key.toString() === c.toString()) {
      // Found same by value
      return key;
    }
  }
  // c is new
  return c;
};

/**
 * Register function that sets up a safe interval or timeout for the given callable function.
 * When invoked, destroys the previous interval or timeout and starts a new one for the provided callable.
 * @param callable Function to be executed at each interval.
 * @param timeout Interval duration in milliseconds.
 * @param callableArgs Additional arguments for the callable function.
 * @param isInterval If true, an interval is created.
 * @param cache The cache object.
 * @param cb Optional callback function to be called with the result of the callable function.
 * @param removeQueue If true, the queue of the callable is removed.
 */
const Register = <T extends Callable>(p: Params<T>, cache: Cache): void => {
  const { ftc, ftq, ftl, ftcb } = cache;
  p.callable = FindSame(p.callable, ftc) as T;
  destroy(p.callable, cache, p.removeQueue);
  setCallback(p.callable, p.cb, ftcb);
  setQueue(p.callable, ftq);
  setLoop(p.callable, ftl);
  Start(p.callable, p.timeout, p.callableArgs, p.isInterval, cache);
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
  const ftc: FunctionToClear = new Map();
  // resolve queue
  const ftq: FunctionToQueue = new Map();
  // track loop status
  const ftl: FunctionToLoop = new Map();
  // to track callbacks
  const ftcb: FunctionToCallback = new Map();

  return { ftc, ftq, ftl, ftcb } as Cache;
};

/**
 * ## Main function to create and manage safe intervals or timeouts for a given function
 * @param p Parameters for the function
 * @param p.callable Callable Function to be called at each interval or timeout
 * @param p.timeout Interval/timeout duration in milliseconds
 * @param p.callableArgs Arguments for the function
 * @param p.isInterval If true, an interval is created
 * @param p.cb Optional callback function to be called with the result of the callable function
 * @param p.removeQueue If true, the queue of the callable is removed
 * @returns A function that, when called, stops the interval from executing further
 *
 * ### Remarks
 *
 * #### Function to manage the execution of a given function at specified intervals, ensuring each invocation completes (resolves) before the next one starts.
 *
 * #### Main points of the safe interval or timeout are:
 * - no shuffling of the callable invocations and resolved results (like if an async function was not finished yet but the next one is already called and finished before the first one)
 * - only one interval or timeout for the same callable
 * - special clear function (if the interval or timeout is cleared before any async operation is called then no call will be made,
 *  if the callable is added to the queue then at least one call will be made
 *  if an interval schedules more than one call and the clear function or reregister happened
 * earlier than all the scheduled calls are resolved then all not resolved and not added to the stack
 * calls which were in the queue are discarded)
 * - no way to create both interval and timeout for the same callable
 * - ability to reregister the callback function (then all unresolved calls from the queue will use the last registered callback for their results)
 * - ability to reregister the callable arguments and timeout which leads to resolving with the new arguments and after the new timeout if the callable wasn't pushed to the queue already
 * - ability to remove previous queue for the callable with reregister
 *
 * Can accept a callback function which is expecting the result of the callable as its argument
 * if the callback is provided then it is going to be called after the callable resolves
 * in case of the interval => the callback is called many times
 * the callback function is used to work with the results of the callable invocations to avoid the need to reference the callback in the callable itself
 */
export const CreateSafe = (() => {
  const cache = CreateMaps();
  //--TestsRelated--SpyOnCache(cache, true);
  /**
   * ## Main function to create and manage safe intervals or timeouts for a given function
   * @param p Parameters for the function
   * @param p.callable Callable Function to be called at each interval or timeout
   * @param p.timeout Interval/timeout duration in milliseconds
   * @param p.callableArgs Arguments for the function
   * @param p.isInterval If true, an interval is created
   * @param p.cb Optional callback function to be called with the result of the callable function
   * @param p.removeQueue If true, the queue of the callable is removed
   * @returns A function that, when called, stops the interval from executing further
   */
  return <T extends Callable>(p: Params<T>): (() => void) => {
    Register(p, cache);
    // return the function to destroy the interval
    return () => {
      destroy(p.callable, cache, p.removeQueue);
    };
  };
})();

/**
 * ## Function to create and manage multiple safe intervals or timeouts for a given function.
 * @param p Parameters for the function
 * @param p.callable Callable Function to be called at each interval or timeout
 * @param p.timeout Interval/timeout duration in milliseconds
 * @param p.callableArgs Arguments for the function
 * @param p.isInterval If true, an interval is created
 * @param p.cb Optional callback function to be called with the result of the callable function
 * @param p.removeQueue If true, the queue of the callable is removed
 * @returns A function that, when called, stops the interval from executing further
 *
 * ### Remarks
 *
 * #### Use this function if there is a need to setup multiple intervals/timeouts for the same callable.
 *
 * For example, if there is a need to fetch multiple different resources periodically, or the same resource but with different timeouts.
 * Every call to the function creates a new interval/timeout for the callable.
 *
 * #### Characteristics which remain from CreateSafe are:
 * - no shuffling of the callable invocations and resolved results (inside the same interval)
 * - special clear function
 * - can accept a callback
 *
 * #### Not like CreateSafe:
 * - creates interval/timeout for the same callable each time allowing for not related intervals/timeouts calling the same callable (no matter the arguments, timeout)
 * there is no closure over the cache here so
 * each call creates a new cache and the calls are not related through the cache or by any other means
 */
export const CreateSafeMultiple = <T extends Callable>(p: Params<T>) => {
  const cache = CreateMaps();
  //--TestsRelated--SpyOnCache(cache);
  Register(p, cache);
  // return the function to destroy the interval
  return () => {
    destroy(p.callable, cache, p.removeQueue);
  };
};

export default {
  CreateSafe,
  CreateSafeMultiple,
};
