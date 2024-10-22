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
        // and repeat
        loop();
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
        FunctionsToClear.delete(callable);
      }
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

export const CreateSafeTimeout = (() => {
  // to track all functions that are called in the safe timeout
  const FunctionsToClear: Map<
    (...args: unknown[]) => void,
    (() => void) | undefined
  > = new Map();
  /**
   * Start a new safe timeout for the provided function.
   * @param callable Function to be called at the timeout.
   * @param timeout Timeout in milliseconds.
   * @param callableArgs Arguments for the function.
   */
  const startNewSafeTimeout = (
    callable: (...args: unknown[]) => void,
    timeout: number | undefined,
    ...callableArgs: unknown[]
  ) => {
    setTimeout(async () => {
      const Clear = FunctionsToClear.get(callable);
      if (Clear) {
        // could be a register callback or destroy callback
        // in case of a register callback
        // the call will reregister the timeout with the new arguments and timeout in ms
        // in case of a destroy callback the call will destroy the timeout completely
        // in any case the callable will not be actually called here
        Clear();
        return;
      } else {
        // if here this means that no new timeout request was made for the same callable
        // after the timeout was created
        // and no destroy callback was registered before the timeout scheduled the function to be called
        // then destroy the timeout here
        if (FunctionsToClear.has(callable)) FunctionsToClear.delete(callable);
      }
      // and finally wait till the function is fully executed
      await callable(...callableArgs);
    }, timeout);
  };

  /**
   * Register a function and its corresponding "Register callback" function (the function here is set to undefined, the actual register callback is set elsewhere).
   * @param callable Function to be called at the timeout expiration.
   */
  const registerFunction = (callable: (...args: unknown[]) => void) => {
    FunctionsToClear.set(callable, undefined);
  };

  /**
   * Creates a register callback that sets up a safe timeout for the given callable function.
   * The callback, when invoked, registers the function and starts a new timeout for it.
   * @param callable Function to be executed at the timeout expiration.
   * @param timeout Timeout duration in milliseconds.
   * @param callableArgs Additional arguments for the callable function.
   * @returns A function that, when called, registers and initiates the timeout.
   */
  const createRegisterCallback = (
    callable: (...args: unknown[]) => void,
    timeout: number | undefined,
    ...callableArgs: unknown[]
  ): (() => void) => {
    return () => {
      registerFunction(callable);
      startNewSafeTimeout(callable, timeout, ...callableArgs);
    };
  };
  /**
   * Main function to create and manage safe timeout for a given function.
   * @param callable Function to be called at the timeout.
   * @param timeout Timeout in milliseconds.
   * @param callableArgs Arguments for the function.
   */
  return (
    callable: (...args: unknown[]) => void,
    timeout: number | undefined,
    ...callableArgs: unknown[]
  ): (() => void) => {
    const registerCallback = createRegisterCallback(
      callable,
      timeout,
      callableArgs,
    );
    if (FunctionsToClear.has(callable)) {
      // if the callable has already been registered
      // this means that the callable has already been scheduled and not finished yet
      // because if it finished then it should have been destroyed
      // register the new callback which should run after the currently active callable finishes executing
      FunctionsToClear.set(callable, registerCallback);
    } else {
      // if the callable has not been registered
      registerCallback();
    }
    // in any case return the destroy callback setter
    // which will on invocation set the destroy callback in the map
    // for the callable
    // the destroy callback if present will be called before the next callable call
    // on the currently active timeout
    // and completely stop the interval and remove the callable from the map
    return () => {
      if (FunctionsToClear.has(callable)) {
        FunctionsToClear.set(callable, () => FunctionsToClear.delete(callable));
      }
    };
  };
})();
