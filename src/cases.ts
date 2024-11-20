import {
  CreateSafeInterval,
  CreateSafeIntervalMultiple,
  CreateSafeTimeout,
} from "./index.js";

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
CreateSafeInterval(LogMessage, 1000, ["1"]);
CreateSafeInterval(LogMessage, 1000, ["2"]);
CreateSafeInterval(LogMessage, 1000, ["3"]);

// standard setInterval behavior, if not cleared all 3 calls will be executed:
setInterval(LogMessage, 1000, "1");
setInterval(LogMessage, 1000, "2");
setInterval(LogMessage, 1000, "3");

// case with create safe interval and waiting for timeout with synchronous function
CreateSafeInterval(LogMessage, 1000, ["1"]);
setTimeout(() => CreateSafeInterval(LogMessage, 1000, ["2"]), 3000);
setTimeout(() => CreateSafeInterval(LogMessage, 1000, ["3"]), 5000);

// standard setInterval behavior, if not cleared all 3 calls will be executed:
setInterval(LogMessage, 1000, "1");
setTimeout(() => setInterval(LogMessage, 1000, "2"), 3000);
setTimeout(() => setInterval(LogMessage, 1000, "3"), 5000);

// case with create safe interval and multiple synchronous functions
CreateSafeInterval(LogMessage, 1000, ["1"]);
CreateSafeInterval(LogMessage, 1000, ["2"]);
CreateSafeInterval(LogMessage, 1000, ["from lm1"]);

CreateSafeInterval(LogMessage2, 1000, ["3"]);
CreateSafeInterval(LogMessage2, 1000, ["4"]);
CreateSafeInterval(LogMessage2, 1000, ["from lm2"]);

// standard setInterval behavior, if not cleared all 6 calls will be executed:
setInterval(LogMessage, 1000, "1");
setInterval(LogMessage, 1000, "2");
setInterval(LogMessage, 1000, "from lm1");

setInterval(LogMessage2, 1000, "3");
setInterval(LogMessage2, 1000, "4");
setInterval(LogMessage2, 1000, "from lm2");

// case with create safe timeout and single synchronous function registered multiple times
CreateSafeTimeout(LogMessage, 1000, ["1"]);
CreateSafeTimeout(LogMessage, 1000, ["2"]);
CreateSafeTimeout(LogMessage, 1000, ["3"]);

// standard setTimeout behavior, if not cleared all 3 calls will be executed:
setTimeout(LogMessage, 1000, "1");
setTimeout(LogMessage, 1000, "2");
setTimeout(LogMessage, 1000, "3");

// case with create safe timeout and waiting for timeout with synchronous function
CreateSafeTimeout(LogMessage, 1000, ["1"]);
setTimeout(() => CreateSafeTimeout(LogMessage, 1000, ["2"]), 3000);
setTimeout(() => CreateSafeTimeout(LogMessage, 1000, ["3"]), 5000);

// here standard setTimeout works the same way
setTimeout(LogMessage, 1000, "1");
setTimeout(() => setTimeout(LogMessage, 1000, "2"), 3000);
setTimeout(() => setTimeout(LogMessage, 1000, "3"), 5000);

// case with create safe timeout and multiple synchronous functions
CreateSafeTimeout(LogMessage, 1000, ["1"]);
CreateSafeTimeout(LogMessage, 1000, ["2"]);
CreateSafeTimeout(LogMessage, 1000, ["from lm1"]);

CreateSafeTimeout(LogMessage2, 1000, ["3"]);
CreateSafeTimeout(LogMessage2, 1000, ["4"]);
CreateSafeTimeout(LogMessage2, 1000, ["from lm2"]);

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
CreateSafeInterval(AsyncLogMessage, 1000, ["1"]);
CreateSafeInterval(AsyncLogMessage, 1000, ["2"]);
CreateSafeInterval(AsyncLogMessage, 1000, ["3"]);

// THE STANDARD TESTS HERE AND AFTER ARE THE SAME AS WITH SYNCHRONOUS FUNCTIONS
// standard setInterval behavior, if not cleared all 3 calls will be executed:
setInterval(AsyncLogMessage, 1000, "1");
setInterval(AsyncLogMessage, 1000, "2");
setInterval(AsyncLogMessage, 1000, "3");

// case with create safe interval and waiting for timeout with asynchronous function
CreateSafeInterval(AsyncLogMessage, 1000, ["1"]);
setTimeout(() => CreateSafeInterval(AsyncLogMessage, 1000, ["2"]), 3000);
setTimeout(() => CreateSafeInterval(AsyncLogMessage, 1000, ["3"]), 6000);

// case with create safe interval and multiple asynchronous functions
CreateSafeInterval(AsyncLogMessage, 1000, ["1"]);
CreateSafeInterval(AsyncLogMessage, 1000, ["2"]);
CreateSafeInterval(AsyncLogMessage, 1000, ["from lm1"]);

CreateSafeInterval(AsyncLogMessage2, 1000, ["3"]);
CreateSafeInterval(AsyncLogMessage2, 1000, ["4"]);
CreateSafeInterval(AsyncLogMessage2, 1000, ["from lm2"]);

// case with create safe timeout and single asynchronous function registered multiple times
CreateSafeTimeout(AsyncLogMessage, 1000, ["1"]);
CreateSafeTimeout(AsyncLogMessage, 1000, ["2"]);
CreateSafeTimeout(AsyncLogMessage, 1000, ["3"]);

// case with create safe timeout and waiting for timeout with asynchronous function
CreateSafeTimeout(AsyncLogMessage, 1000, ["1"]);
setTimeout(() => CreateSafeTimeout(AsyncLogMessage, 1000, ["2"]), 3000);
setTimeout(() => CreateSafeTimeout(AsyncLogMessage, 1000, ["3"]), 6000);

// case with create safe timeout and multiple asynchronous functions
CreateSafeTimeout(AsyncLogMessage, 1000, ["1"]);
CreateSafeTimeout(AsyncLogMessage, 1000, ["2"]);
CreateSafeTimeout(AsyncLogMessage, 1000, ["from lm1"]);

CreateSafeTimeout(AsyncLogMessage2, 1000, ["3"]);
CreateSafeTimeout(AsyncLogMessage2, 1000, ["4"]);
CreateSafeTimeout(AsyncLogMessage2, 1000, ["from lm2"]);

// NO CALL RESULTS SHUFFLE PROPERTY
// WHEN AN ASYNC FUNCTION IS REGISTERED WITH SAFE INTERVAL THE NEXT INVOCATION WILL BE ONLY AFTER THE PREVIOUS ONE RESOLVES
// WHEN AN ASYNC FUNCTION IS REGISTERED WITH SAFE TIMEOUT
// IN CASES WHEN THE TIMEOUT HAS PASSED AND THE FUNCTION IS ADDED TO THE STACK TO BE EXECUTED BUT DIDN'T RESOLVE YET
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
const c1 = CreateSafeInterval(RandomAsyncLog, 1000, []);
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
CreateSafeTimeout(RandomAsyncLog, 1000, [5000]); // register 1000ms timeout with async function resolving after 5000ms
setTimeout(() => {
  CreateSafeTimeout(RandomAsyncLog, 0, [1]);
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
const c3 = CreateSafeIntervalMultiple(RandomAsyncLog, 1000, []);
setTimeout(() => c3(), 5000);

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
CreateSafeInterval(SyncNumIdentity, 1000, [1], LogNumCallback);
// the same but with standard interval
// the callback has to be defined in the SyncNumIdentity for example
const SyncNumIdentityWithLog = (a: number) => {
  console.log("Logging from SyncNumIdentityWithLog:");
  console.log(a);
  return a;
};
setInterval(SyncNumIdentityWithLog, 1000, 1);

// the same with async functions
// but every 2 seconds for the safe interval
// and 2 seconds the first time and then every ~1 second for the standard interval
CreateSafeInterval(AsyncNumIdentity, 1000, [1], LogNumCallback);

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

CreateSafeTimeout(SyncNumIdentity, 1000, [1], LogNumCallback);

setTimeout(SyncNumIdentityWithLog, 1000, 1);

CreateSafeTimeout(AsyncNumIdentity, 1000, [1], LogNumCallback);

setTimeout(AsyncNumIdentityWithLog, 1000, 1);
