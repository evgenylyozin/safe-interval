/**
 * CODE SNIPPETS WHICH WERE USED
 * TO CREATE THE DEMO GIFS AND MP4S
 */
/**
 * Resolve with some random number from 0 to 1000
 * in the timeframe of ~from 0 to 1000 ms
 */
// const ResolveRandomly = (): Promise<number> => {
//     const ms = Math.random()*1000
//     console.log(`Scheduling new resolve in ${ms}ms...`)
//     return new Promise((r)=>{
//         setTimeout(()=>{
//             console.log(`Resolved in ${ms}ms`)
//             r(ms)
//         },ms)
//     })
// }

/**
 * The callback which receives the resolved result of
 * ResolveRandomly, just loggs the result
 */
// const LogCallback = (ms: number) => {
//     console.log(`Got data in LogCallback, got ms: ${ms}`)
// }

// const clear = CreateSafe({
//     callable: ResolveRandomly,
//     callableArgs: [],
//     timeout: 100,
//     isInterval: true, // this is an interval
//     cb: LogCallback // the callback is registered here
// })
// // stop the interval
// setTimeout(clear,500)

/**
 * To work with the results in the standard interval
 * we would need to either add the logic in the passed in
 * function like here or process the result inside the periodically
 * called function
 * And the results could shuffle
 */
// const intervalID = setInterval(async()=>{
//     const result = await ResolveRandomly()
//     console.log(`Got data inside the standard interval, got ms: ${result}`)
// },100,[])
// setTimeout(()=>clearInterval(intervalID),500)

// Log "HAS BEEN CALLED" with the timeout
// of 1 second after the function
// has been added to the stack
// const LogAsync = () => {
//   return new Promise((r) => {
//     setTimeout(() => {
//       r(console.log("HAS BEEN CALLED"));
//     }, 1000);
//   });
// };

// every 100 ms add LogAsync to the queue
// but clear the queue on clear call
// const clear = CreateSafe({
//   callable: LogAsync,
//   timeout: 100,
//   callableArgs: [],
//   isInterval: true, // it is an interval
//   removeQueue: true, // set the queue to be cleared
// });
// many calls should be added to the queue
// but only 1 (the first one) is actually
// added to the stack and executed if the
// queue is removed
// setTimeout(clear, 1000);

// every 100 ms add LogAsync to the stack
// since it is added to the stack directly
// all scheduled calls are executed
// const standardInterval = setInterval(LogAsync, 100);
// setTimeout(() => clearInterval(standardInterval), 1000);

// const clear = CreateSafe({
//   callable: ResolveRandomly,
//   callableArgs: [],
//   timeout: 100,
//   isInterval: true,
// });
// setTimeout(clear, 500);

// const intervalID = setInterval(ResolveRandomly, 100, [])
// setTimeout(()=>clearInterval(intervalID), 500);

// initialize the last call timestamp
// let LastCallTimestamp = Date.now();

// const LogMessage = (m: string) => {
//   const Now = Date.now();
//   const SecondsElapsed = Math.round((Now - LastCallTimestamp) / 1000);
//   LastCallTimestamp = Now;
//   console.log(`The timeout is ${SecondsElapsed} seconds, the message is: ${m}`);
// };

// creating safe interval multiple times for the same function
// results in a single interval with the latest timeout and arguments
// CreateSafe({
//   callable: LogMessage,
//   timeout: 1000,
//   callableArgs: ["1"],
//   isInterval: true,
// });
// CreateSafe({
//   callable: LogMessage,
//   timeout: 1000,
//   callableArgs: ["2"],
//   isInterval: true,
// });
// CreateSafe({
//   callable: LogMessage,
//   timeout: 2000,
//   callableArgs: ["3"],
//   isInterval: true,
// });

// standard setInterval
// if not cleared then all 3 intervals will be executed
// setInterval(LogMessage, 1000, "1");
// setInterval(LogMessage, 1000, "2");
// setInterval(LogMessage, 2000, "3");
