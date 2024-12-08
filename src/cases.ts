// import {
//   CreateSafeInterval,
//   CreateSafeIntervalMultiple,
//   CreateSafeTimeout,
// } from "./index.js";

import { CreateSafe, CreateSafeMultiple } from "./index.js";

/**
 * ACTUAL CASES WHICH DEMONSTRATE THE DIFFERENCES
 * BETWEEN SAFE INTERVAL AND STANDARD INTERVAL
 * AND SAFE TIMEOUT AND STANDARD TIMEOUT
 */

// REWRITE PROPERTY (SAFE INTERVAL AND TIMEOUT PROTECTS FROM REGISTERING THE SAME CALLABLE MULTIPLE TIMES EVEN WITH NO CLEAR CALL AND REWRITES ARGUMENTS AND TIMEOUT IF THEY CHANGE)

// synchronous functions
const LogMessage = (m: string) => console.log(m);
const LogMessage2 = (m: string) => console.log(m);

// case with create safe interval and single synchronous function registered multiple times
CreateSafe(LogMessage, 1000, ["1"], true);
CreateSafe(LogMessage, 1000, ["2"], true);
CreateSafe(LogMessage, 1000, ["3"], true);

// standard setInterval behavior, if not cleared all 3 calls will be executed:
setInterval(LogMessage, 1000, "1", true);
setInterval(LogMessage, 1000, "2", true);
setInterval(LogMessage, 1000, "3", true);

// case with create safe interval and waiting for timeout with synchronous function
CreateSafe(LogMessage, 1000, ["1"], true);
setTimeout(() => CreateSafe(LogMessage, 1000, ["2"], true), 3000);
setTimeout(() => CreateSafe(LogMessage, 1000, ["3"], true), 5000);

// standard setInterval behavior, if not cleared all 3 calls will be executed:
setInterval(LogMessage, 1000, "1");
setTimeout(() => setInterval(LogMessage, 1000, "2"), 3000);
setTimeout(() => setInterval(LogMessage, 1000, "3"), 5000);

// case with create safe interval and multiple synchronous functions (log message and log message 2 are different functions so both will be called separately)
CreateSafe(LogMessage, 1000, ["1"], true);
CreateSafe(LogMessage, 1000, ["2"], true);
CreateSafe(LogMessage, 1000, ["from lm1"], true);

CreateSafe(LogMessage2, 1000, ["3"], true);
CreateSafe(LogMessage2, 1000, ["4"], true);
CreateSafe(LogMessage2, 1000, ["from lm2"], true);

// standard setInterval behavior, if not cleared all 6 calls will be executed:
setInterval(LogMessage, 1000, "1");
setInterval(LogMessage, 1000, "2");
setInterval(LogMessage, 1000, "from lm1");

setInterval(LogMessage2, 1000, "3");
setInterval(LogMessage2, 1000, "4");
setInterval(LogMessage2, 1000, "from lm2");

// case with create safe timeout and single synchronous function registered multiple times
CreateSafe(LogMessage, 1000, ["1"], false);
CreateSafe(LogMessage, 1000, ["2"], false);
CreateSafe(LogMessage, 1000, ["3"], false);

// standard setTimeout behavior, if not cleared all 3 calls will be executed:
setTimeout(LogMessage, 1000, "1");
setTimeout(LogMessage, 1000, "2");
setTimeout(LogMessage, 1000, "3");

// case with create safe timeout and waiting for timeout with synchronous function
CreateSafe(LogMessage, 1000, ["1"], false);
setTimeout(() => CreateSafe(LogMessage, 1000, ["2"], false), 3000);
setTimeout(() => CreateSafe(LogMessage, 1000, ["3"], false), 5000);

// here standard setTimeout works the same way
setTimeout(LogMessage, 1000, "1");
setTimeout(() => setTimeout(LogMessage, 1000, "2"), 3000);
setTimeout(() => setTimeout(LogMessage, 1000, "3"), 5000);

// case with create safe timeout and multiple synchronous functions
CreateSafe(LogMessage, 1000, ["1"], false);
CreateSafe(LogMessage, 1000, ["2"], false);
CreateSafe(LogMessage, 1000, ["from lm1"], false);

CreateSafe(LogMessage2, 1000, ["3"], false);
CreateSafe(LogMessage2, 1000, ["4"], false);
CreateSafe(LogMessage2, 1000, ["from lm2"], false);

// standard setTimeout behavior, if not cleared all 6 calls will be executed:
setTimeout(LogMessage, 1000, "1");
setTimeout(LogMessage, 1000, "2");
setTimeout(LogMessage, 1000, "from lm1");

setTimeout(LogMessage2, 1000, "3");
setTimeout(LogMessage2, 1000, "4");
setTimeout(LogMessage2, 1000, "from lm2");

// asynchronous functions work the same as sync functions
// REWRITE property applies here too
const AsyncLogMessage = async (m: string) =>
  new Promise((r) => {
    setTimeout(() => {
      console.log(m);
      r(m);
    }, 1000);
  });
const AsyncLogMessage2 = async (m: string) =>
  new Promise((r) => {
    setTimeout(() => {
      console.log(m);
      r(m);
    }, 1000);
  });

// case with create safe interval and single asynchronous function registered multiple times
CreateSafe(AsyncLogMessage, 1000, ["1"], true);
CreateSafe(AsyncLogMessage, 1000, ["2"], true);
CreateSafe(AsyncLogMessage, 1000, ["3"], true);

// THE STANDARD TESTS HERE AND AFTER ARE THE SAME AS WITH SYNCHRONOUS FUNCTIONS
// standard setInterval behavior, if not cleared all 3 calls will be executed:
setInterval(AsyncLogMessage, 1000, "1");
setInterval(AsyncLogMessage, 1000, "2");
setInterval(AsyncLogMessage, 1000, "3");

// case with create safe interval and waiting for timeout with asynchronous function
CreateSafe(AsyncLogMessage, 1000, ["1"], true);
setTimeout(() => CreateSafe(AsyncLogMessage, 1000, ["2"], true), 3000);
setTimeout(() => CreateSafe(AsyncLogMessage, 1000, ["3"], true), 6000);

// case with create safe interval and multiple asynchronous functions
CreateSafe(AsyncLogMessage, 1000, ["1"], true);
CreateSafe(AsyncLogMessage, 1000, ["2"], true);
CreateSafe(AsyncLogMessage, 1000, ["from lm1"], true);

CreateSafe(AsyncLogMessage2, 1000, ["3"], true);
CreateSafe(AsyncLogMessage2, 1000, ["4"], true);
CreateSafe(AsyncLogMessage2, 1000, ["from lm2"], true);

// case with create safe timeout and single asynchronous function registered multiple times
CreateSafe(AsyncLogMessage, 1000, ["1"], false);
CreateSafe(AsyncLogMessage, 1000, ["2"], false);
CreateSafe(AsyncLogMessage, 1000, ["3"], false);

// case with create safe timeout and waiting for timeout with asynchronous function
CreateSafe(AsyncLogMessage, 1000, ["1"], false);
setTimeout(() => CreateSafe(AsyncLogMessage, 1000, ["2"], false), 3000);
setTimeout(() => CreateSafe(AsyncLogMessage, 1000, ["3"], false), 6000);

// case with create safe timeout and multiple asynchronous functions
CreateSafe(AsyncLogMessage, 1000, ["1"], false);
CreateSafe(AsyncLogMessage, 1000, ["2"], false);
CreateSafe(AsyncLogMessage, 1000, ["from lm1"], false);

CreateSafe(AsyncLogMessage2, 1000, ["3"], false);
CreateSafe(AsyncLogMessage2, 1000, ["4"], false);
CreateSafe(AsyncLogMessage2, 1000, ["from lm2"], false);

// NO CALL RESULTS SHUFFLE PROPERTY
// WHEN AN ASYNC FUNCTION IS REGISTERED WITH SAFE INTERVAL THE NEXT INVOCATION WILL BE ONLY AFTER THE PREVIOUS ONE RESOLVES
// WHEN AN ASYNC FUNCTION IS REGISTERED WITH SAFE TIMEOUT
// IN CASES WHEN THE TIMEOUT HAS PASSED AND THE FUNCTION IS ADDED TO THE QUEUE TO BE EXECUTED BUT DIDN'T RESOLVE YET
// AND THE NEXT SET TIMEOUT COMES IN FOR THE SAME FUNCTION EVEN WITH THE TIMEOUT AND RESOLVE TIME LESS THAN THE TIMEOUT FOR THE PREVIOUS REGISTRATION
// THE FUNCTIONS RESOLVE IN ORDER THEY WERE REGISTERED

const registerQueue = [];
const resolveQueue = [];
const PrintQueues = () => {
  console.log("registerQueue:", registerQueue);
  console.log("resolveQueue:", resolveQueue);
};
const WaitTillLastResolvedAndPrintQueues = () => {
  const LastResolveTime = resolveQueue[resolveQueue.length - 1];
  setTimeout(PrintQueues, LastResolveTime);
};
const RandomAsyncLog = async (waitFor?: number) =>
  new Promise((r) => {
    const wait = waitFor ? waitFor : Math.random() * 3000;
    registerQueue.push(wait);
    setTimeout(() => {
      resolveQueue.push(wait);
      r(wait);
    }, wait);
  });

// Create safe interval case:
const c1 = CreateSafe(RandomAsyncLog, 1000, [], true);
setTimeout(() => {
  c1();
  WaitTillLastResolvedAndPrintQueues();
}, 5000);

// standard setInterval behavior, the results can SHUFFLE:
const interval = setInterval(RandomAsyncLog, 1000);
setTimeout(() => {
  clearInterval(interval);
  WaitTillLastResolvedAndPrintQueues();
}, 5000);

// Create safe timeout case:
CreateSafe(RandomAsyncLog, 1000, [5000], false); // register 1000ms timeout with async function resolving after 5000ms
setTimeout(() => {
  CreateSafe(RandomAsyncLog, 0, [1], false);
}, 1500); // after 1500ms register new 0ms timeout with async function resolving after 1ms (when the previous function is already on the stack)
setTimeout(() => {
  WaitTillLastResolvedAndPrintQueues();
}, 7500); // wait all functions to resolve

// standard setTimeout behavior, the results will SHUFFLE:
setTimeout(RandomAsyncLog, 1000, 5000);
setTimeout(() => {
  setTimeout(RandomAsyncLog, 0, 1);
}, 1500);
setTimeout(() => {
  WaitTillLastResolvedAndPrintQueues();
}, 7500);

// CreateSafeIntervalMultiple case:
// the only noticeable difference between the CreateSafeIntervalMultiple and default setInterval is when working with async functions
// randomly resolving function results will always be in the order the function was called
const c3 = CreateSafeMultiple(RandomAsyncLog, 1000, [], true);
setTimeout(() => {
  c3();
  PrintQueues();
}, 5000);

// CreateSafeTimeout is the same as setTimeout in regards with async functions

// CASES WITH THE CALLBACK FUNCTION DEFINED
//
// WITH STANDARD INTERVAL OR TIMEOUT THE RESULTS COULD BE
// USED ONLY IF THE FUNCTION WHICH IS CALLED IN THE
// INTERVAL OR TIMEOUT CALLS EXTERNAL FUNCTIONS ITSELF

// IN GENERAL, PROVIDING THE CALLBACK ALLOWS FOR DECOUPLING
// THE FUNCTION CALL AND THE CALL RESULT HANDLING
const SyncNumIdentity = (a: number) => a;
const AsyncNumIdentity = (a: number): Promise<number> =>
  new Promise((r) => setTimeout(() => r(a), 1000));
const LogNumCallback = (a: number) => {
  console.log("Logging from LogNumCallback:");
  console.log(a);
};
// each second the callback should be called with the number 1
CreateSafe(SyncNumIdentity, 1000, [1], true, LogNumCallback);
// the same but with standard interval
// the callback has to be defined in the SyncNumIdentity for example
const SyncNumIdentityWithLog = (a: number) => {
  console.log("Logging from SyncNumIdentityWithLog:");
  console.log(a);
  return a;
};
setInterval(SyncNumIdentityWithLog, 1000, 1);

// the same with async functions
// but 2 seconds the first time and then every ~1 second
CreateSafe(AsyncNumIdentity, 1000, [1], true, LogNumCallback);

const AsyncNumIdentityWithLog = (a: number) =>
  new Promise((r) => {
    setTimeout(() => {
      console.log("Logging from AsyncNumIdentityWithLog:");
      console.log(a);
      r(a);
    }, 1000);
  });
setInterval(AsyncNumIdentityWithLog, 1000, 1);

// the same for sync and async functions used in safe timeout

CreateSafe(SyncNumIdentity, 1000, [1], false, LogNumCallback);

setTimeout(SyncNumIdentityWithLog, 1000, 1);

CreateSafe(AsyncNumIdentity, 1000, [1], false, LogNumCallback);

setTimeout(AsyncNumIdentityWithLog, 1000, 1);
