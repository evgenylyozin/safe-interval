import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CreateSafeInterval,
  CreateSafeIntervalMultiple,
  CreateSafeTimeout,
  CreateSafeTimeoutMultiple,
} from "../src/index.js";

const DataIdentity = (data: string) => {
  return data;
};

const DataIdentityMock = vi.fn(DataIdentity);
describe("testing CreateSafeInterval with synchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("only one interval for the same callable", async () => {
    // the callable should be called once with the expected data
    // only one interval for the same callable
    // even with different inputs and timeout
    CreateSafeInterval(DataIdentityMock, 0, ["1"]);
    CreateSafeInterval(DataIdentityMock, 100000, ["2"]);
    CreateSafeInterval(DataIdentityMock, 0, ["3"]);
    CreateSafeInterval(DataIdentityMock, 3, ["4"]);
    const clear = CreateSafeInterval(DataIdentityMock, 2000, ["5"]);
    await vi.advanceTimersToNextTimerAsync();
    expect(DataIdentityMock).toBeCalledTimes(1);
    expect(DataIdentityMock).toBeCalledWith("5");
    expect(DataIdentityMock).toReturnWith("5");
    clear();
  });
  it("interval stops and no callable is executed if the clear function is called before the timeout", async () => {
    const clear = CreateSafeInterval(DataIdentityMock, 5000, ["1000000"]);
    clear();
    await vi.advanceTimersToNextTimerAsync();
    expect(DataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout", async () => {
    const clear = CreateSafeInterval(DataIdentityMock, 5000, ["1000000"]);
    await vi.advanceTimersByTimeAsync(5000);
    clear();
    expect(DataIdentityMock).toBeCalledTimes(1);
    expect(DataIdentityMock).toBeCalledWith("1000000");
    expect(DataIdentityMock).toReturnWith("1000000");
  });
  it("the callable is executed twice if the clear function is called after 2 timeouts passed, meaning the clear stops the interval after 2 ticks", async () => {
    const clear = CreateSafeInterval(DataIdentityMock, 5000, []);
    await vi.advanceTimersByTimeAsync(10000);
    clear();
    await vi.advanceTimersByTimeAsync(1000000); // no more timers should be called
    expect(DataIdentityMock).toBeCalledTimes(2);
  });
});

const AsyncDataIdentity = async (data: string) => {
  return new Promise<string>((res) => {
    setTimeout(() => {
      res(data);
    }, 1000);
  });
};
const AsyncDataIdentityMock = vi.fn(AsyncDataIdentity);
const ResolveRandomly = async (randMS: number) => {
  return new Promise<number>((res) => {
    setTimeout(() => {
      res(randMS);
    }, randMS);
  });
};
const ResolveRandomlyMock = vi.fn(ResolveRandomly);

const expectedRandomMSArray: number[] = [];
const actualRandomMSArray: number[] = [];
const ResolveRandomlySingleIntervalMock = vi.fn(async () => {
  const randMS = (Math.random() * 10 + 2) * 1000;
  expectedRandomMSArray.push(randMS);
  const result = await ResolveRandomly(randMS);
  actualRandomMSArray.push(result);
});

/**
 * Passes a single tick (timeout) and waits for the promise to be resolved.
 * The promise is awaited with the advanceTimersToNextTimerAsync function.
 * This is because the promise is constructed to be resolved after the timeout.
 * @param tickTimeout the timeout in milliseconds
 */
const PassTickAndWaitForResolve = async (tickTimeout: number) => {
  await vi.advanceTimersByTimeAsync(tickTimeout); // pass the tick
  await vi.advanceTimersToNextTimerAsync(); // make sure the promise is resolved
};
/**
 * Passes a specified number of ticks (timeouts) and waits for the promises to be resolved.
 * The promises are awaited with the advanceTimersToNextTimerAsync function.
 * This is because the promises are constructed to be resolved after the timeout.
 * @param ticks the number of ticks to pass
 * @param tickTimeout the timeout in milliseconds
 */
const PassTicksAndWaitForResolves = async (
  ticks: number,
  tickTimeout: number,
) => {
  for (let i = 0; i < ticks; i++) {
    await PassTickAndWaitForResolve(tickTimeout);
  }
};
describe("testing CreateSafeInterval with asynchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("only one interval for the same callable", async () => {
    // the callable should be called once with the expected data
    // only one interval for the same callable
    // even with different inputs and timeout
    CreateSafeInterval(AsyncDataIdentityMock, 0, ["1"]);
    CreateSafeInterval(AsyncDataIdentityMock, 100000, ["2"]);
    CreateSafeInterval(AsyncDataIdentityMock, 0, ["3"]);
    CreateSafeInterval(AsyncDataIdentityMock, 3, ["4"]);
    const clear = CreateSafeInterval(AsyncDataIdentityMock, 2000, ["5"]);
    await PassTickAndWaitForResolve(2000);
    clear();
    expect(AsyncDataIdentityMock).toBeCalledTimes(1);
    expect(AsyncDataIdentityMock).toBeCalledWith("5");
    expect(AsyncDataIdentityMock).toHaveResolvedWith("5");
  });
  it("interval stops and no callable is executed if the clear function is called before the timeout", async () => {
    const clear = CreateSafeInterval(AsyncDataIdentityMock, 5000, ["1000000"]);
    clear();
    await vi.advanceTimersByTimeAsync(1000000);
    expect(AsyncDataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout", async () => {
    const clear = CreateSafeInterval(AsyncDataIdentityMock, 5000, ["1000000"]);
    await PassTickAndWaitForResolve(5000);
    clear();
    expect(AsyncDataIdentityMock).toBeCalledTimes(1);
    expect(AsyncDataIdentityMock).toBeCalledWith("1000000");
  });
  it("the callable is executed twice if the clear function is called after 2 timeouts passed, meaning the clear stops the interval after 2 ticks", async () => {
    const clear = CreateSafeInterval(
      ResolveRandomlySingleIntervalMock,
      5000,
      [],
    );
    await PassTicksAndWaitForResolves(2, 5000);
    expect(ResolveRandomlySingleIntervalMock).toBeCalledTimes(2);
    clear(); // remove the interval now
    await vi.advanceTimersByTimeAsync(1000000); // no more timers should be called
    expect(ResolveRandomlySingleIntervalMock).toBeCalledTimes(2);
    expect(ResolveRandomlySingleIntervalMock).toHaveResolvedTimes(2);
  });
  it("no async results mix or overlap if trying to create multiple intervals", async () => {
    // check sequential operations
    for (let i = 0; i < 10; i++) {
      const randMS = (Math.random() * 10 + 2) * 1000;
      const clear = CreateSafeInterval(ResolveRandomlyMock, 1000, [randMS]);
      await PassTickAndWaitForResolve(1000);
      expect(ResolveRandomlyMock).toBeCalledTimes(1);
      expect(ResolveRandomlyMock).toHaveBeenCalledWith(randMS);
      expect(ResolveRandomlyMock).toHaveResolvedWith(randMS);
      ResolveRandomlyMock.mockClear();
      clear();
    }
    // check rewrite operations
    let lastRandMS = 0;
    let clear = undefined;
    for (let i = 0; i < 10; i++) {
      const randMS = (Math.random() * 10 + 2) * 1000;
      clear = CreateSafeInterval(ResolveRandomlyMock, 1000, [randMS]);
      lastRandMS = randMS;
    }
    await PassTicksAndWaitForResolves(10, 1000);
    expect(ResolveRandomlyMock).toBeCalledTimes(10);
    expect(ResolveRandomlyMock).toHaveBeenNthCalledWith(10, lastRandMS);
    expect(ResolveRandomlyMock).toHaveResolvedTimes(10);
    expect(ResolveRandomlyMock).toHaveNthResolvedWith(10, lastRandMS);
    clear();
  });
  it("no async results mix or overlap inside single interval even if the async operation takes longer than the specified timeout", async () => {
    const clear = CreateSafeInterval(
      ResolveRandomlySingleIntervalMock,
      1000,
      [],
    );
    await PassTicksAndWaitForResolves(10, 1000);
    clear();
    expect(ResolveRandomlySingleIntervalMock).toBeCalledTimes(10);
    expect(expectedRandomMSArray).toEqual(actualRandomMSArray);
  });
});

describe("testing CreateSafeTimeout with synchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("only one timeout for the same callable", async () => {
    // the callable should be called once with the expected data
    // only one timeout for the same callable
    // even with different inputs and timeout
    CreateSafeTimeout(DataIdentityMock, 0, ["1"]);
    CreateSafeTimeout(DataIdentityMock, 100000, ["2"]);
    CreateSafeTimeout(DataIdentityMock, 0, ["3"]);
    CreateSafeTimeout(DataIdentityMock, 3, ["4"]);
    const clear = CreateSafeTimeout(DataIdentityMock, 2000, ["5"]);
    await vi.advanceTimersToNextTimerAsync();
    expect(DataIdentityMock).toBeCalledTimes(1);
    expect(DataIdentityMock).toBeCalledWith("5");
    expect(DataIdentityMock).toReturnWith("5");
    clear();
  });
  it("timeout stops and no callable is executed if the clear function is called before the timeout", async () => {
    const clear = CreateSafeTimeout(DataIdentityMock, 5000, ["1000000"]);
    clear();
    await vi.advanceTimersToNextTimerAsync();
    expect(DataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout", async () => {
    const clear = CreateSafeTimeout(DataIdentityMock, 5000, ["1000000"]);
    await vi.advanceTimersToNextTimerAsync();
    expect(DataIdentityMock).toBeCalledTimes(1);
    expect(DataIdentityMock).toBeCalledWith("1000000");
    expect(DataIdentityMock).toReturnWith("1000000");
    clear();
  });
});

describe("testing CreateSafeTimeout with asynchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("only one timeout for the same callable", async () => {
    // the callable should be called once with the expected data
    // only one timeout for the same callable
    // even with different inputs and timeout
    CreateSafeTimeout(AsyncDataIdentityMock, 0, ["1"]);
    CreateSafeTimeout(AsyncDataIdentityMock, 100000, ["2"]);
    CreateSafeTimeout(AsyncDataIdentityMock, 0, ["3"]);
    CreateSafeTimeout(AsyncDataIdentityMock, 3, ["4"]);
    const clear = CreateSafeTimeout(AsyncDataIdentityMock, 2000, ["5"]);
    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync(); // to make sure the promise is resolved
    expect(AsyncDataIdentityMock).toBeCalledTimes(1);
    expect(AsyncDataIdentityMock).toBeCalledWith("5");
    expect(AsyncDataIdentityMock).toHaveResolvedWith("5");
    clear();
  });
  it("timeout stops and no callable is executed if the clear function is called before the timeout", async () => {
    const clear = CreateSafeTimeout(AsyncDataIdentityMock, 5000, ["1000000"]);
    clear();
    await vi.advanceTimersToNextTimerAsync();
    expect(AsyncDataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout", async () => {
    const clear = CreateSafeTimeout(AsyncDataIdentityMock, 5000, ["1000000"]);
    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync(); // to make sure the promise is resolved
    expect(AsyncDataIdentityMock).toBeCalledTimes(1);
    expect(AsyncDataIdentityMock).toBeCalledWith("1000000");
    clear();
  });
  it("no async results mix or overlap if trying to create multiple timeouts", async () => {
    const expectedResults: number[] = [];
    for (let i = 0; i < 10; i++) {
      const randMS = (Math.random() * 10 + 2) * 1000;
      expectedResults.push(randMS);
      const clear = CreateSafeTimeout(ResolveRandomlyMock, 1000, [randMS]);
      await vi.advanceTimersByTimeAsync(1000); // to start the callable
      clear();
    }

    await vi.advanceTimersByTimeAsync(100000); // to make sure the promises are resolved

    expect(ResolveRandomlyMock).toBeCalledTimes(10);
    expect(expectedResults).toEqual(
      ResolveRandomlyMock.mock.settledResults.map((r) => r.value),
    );
  });
  it("no async results mix or overlap inside single timeout even if the async operation takes longer than the specified timeout", async () => {
    for (let i = 0; i < 10; i++) {
      const clear = CreateSafeTimeout(
        ResolveRandomlySingleIntervalMock,
        1000,
        [],
      ); // here the timeout is created on every iteration since it is not an interval
      await vi.advanceTimersByTimeAsync(1000); // to start the callable
      clear();
    }

    await vi.advanceTimersByTimeAsync(100000); // to make sure the promises are resolved

    expect(ResolveRandomlySingleIntervalMock).toBeCalledTimes(10);
    expect(expectedRandomMSArray).toEqual(actualRandomMSArray);
  });
});

// create safe interval multiple

describe("testing CreateSafeIntervalMultiple with synchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("many intervals for the same callable", async () => {
    // the callable should be called inside any created interval with the expected data
    // even with the same inputs and timeout
    const c1 = CreateSafeIntervalMultiple(DataIdentityMock, 1000, ["1"]);
    const c2 = CreateSafeIntervalMultiple(DataIdentityMock, 1000, ["1"]);
    const c3 = CreateSafeIntervalMultiple(DataIdentityMock, 3000, ["3"]);
    const c4 = CreateSafeIntervalMultiple(DataIdentityMock, 4000, ["4"]);
    const c5 = CreateSafeIntervalMultiple(DataIdentityMock, 5000, ["5"]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(DataIdentityMock).toBeCalledTimes(13);
    const resultsArray = DataIdentityMock.mock.results.map((r) => r.value);
    expect(resultsArray).toEqual([
      "1",
      "1",
      "1",
      "1",
      "3",
      "1",
      "1",
      "4",
      "1",
      "1",
      "5",
      "1",
      "1",
    ]);
    c1();
    c2();
    c3();
    c4();
    c5();
  });
  it("intervals stop and no callable is executed if the clear function is called before the timeout", async () => {
    const c1 = CreateSafeIntervalMultiple(DataIdentityMock, 0, ["1"]);
    const c2 = CreateSafeIntervalMultiple(DataIdentityMock, 1, ["1"]);
    const c3 = CreateSafeIntervalMultiple(DataIdentityMock, 2, ["3"]);
    const c4 = CreateSafeIntervalMultiple(DataIdentityMock, 3, ["4"]);
    const c5 = CreateSafeIntervalMultiple(DataIdentityMock, 4, ["5"]);
    c1();
    c2();
    c3();
    c4();
    c5();
    await vi.advanceTimersByTimeAsync(50000);
    expect(DataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after 1 timeout", async () => {
    const c1 = CreateSafeIntervalMultiple(DataIdentityMock, 1, ["1"]);
    const c2 = CreateSafeIntervalMultiple(DataIdentityMock, 1, ["1"]);
    const c3 = CreateSafeIntervalMultiple(DataIdentityMock, 1, ["3"]);
    const c4 = CreateSafeIntervalMultiple(DataIdentityMock, 1, ["4"]);
    const c5 = CreateSafeIntervalMultiple(DataIdentityMock, 1, ["5"]);
    await vi.advanceTimersByTimeAsync(1);
    c1();
    c2();
    c3();
    c4();
    c5();
    expect(DataIdentityMock).toBeCalledTimes(5);
    const resultsArray = DataIdentityMock.mock.results.map((r) => r.value);
    expect(resultsArray).toEqual(["1", "1", "3", "4", "5"]);
  });
  it("the callable is executed twice in each interval if the clear function is called after 2 timeouts passed, meaning the clear stops the interval after 2 ticks", async () => {
    const c1 = CreateSafeIntervalMultiple(DataIdentityMock, 1, ["1"]);
    const c2 = CreateSafeIntervalMultiple(DataIdentityMock, 1, ["1"]);
    const c3 = CreateSafeIntervalMultiple(DataIdentityMock, 1, ["3"]);
    const c4 = CreateSafeIntervalMultiple(DataIdentityMock, 1, ["4"]);
    const c5 = CreateSafeIntervalMultiple(DataIdentityMock, 1, ["5"]);
    await vi.advanceTimersByTimeAsync(2);
    c1();
    c2();
    c3();
    c4();
    c5();
    await vi.advanceTimersByTimeAsync(50000);
    expect(DataIdentityMock).toBeCalledTimes(10);
    const resultsArray = DataIdentityMock.mock.results.map((r) => r.value);
    expect(resultsArray).toEqual([
      "1",
      "1",
      "3",
      "4",
      "5",
      "1",
      "1",
      "3",
      "4",
      "5",
    ]);
  });
});

describe("testing CreateSafeIntervalMultiple with asynchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("many intervals for the same callable", async () => {
    // the callable should be called inside any created interval with the expected data
    // even with the same inputs and timeout
    const c1 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 1000, ["1"]); // these register 3 callbacks during 5 seconds and the last cb resolves because we wait for it in the PassTickAndWaitForResolve later
    const c2 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 1000, ["1"]);
    const c3 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 3000, ["3"]);
    const c4 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 4000, ["4"]);
    const c5 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 5000, ["5"]);
    await PassTickAndWaitForResolve(5000);
    c1();
    c2();
    c3();
    c4();
    c5();
    expect(AsyncDataIdentityMock).toBeCalledTimes(9);
    const resultsArray = AsyncDataIdentityMock.mock.settledResults.map(
      (r) => r.value,
    );
    expect(resultsArray).toEqual(["1", "1", "3", "1", "1", "4", "5", "1", "1"]);
  });
  it("intervals stop and no callable is executed if the clear function is called before the timeout", async () => {
    const c1 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 0, ["1"]);
    const c2 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 1, ["1"]);
    const c3 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 2, ["3"]);
    const c4 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 3, ["4"]);
    const c5 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 4, ["5"]);
    c1();
    c2();
    c3();
    c4();
    c5();
    await vi.advanceTimersByTimeAsync(50000);
    expect(AsyncDataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout", async () => {
    const c1 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 1, ["1"]);
    const c2 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 1, ["1"]);
    const c3 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 1, ["3"]);
    const c4 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 1, ["4"]);
    const c5 = CreateSafeIntervalMultiple(AsyncDataIdentityMock, 1, ["5"]);
    await PassTickAndWaitForResolve(1);
    c1();
    c2();
    c3();
    c4();
    c5();
    expect(AsyncDataIdentityMock).toBeCalledTimes(5);
    const resultsArray = AsyncDataIdentityMock.mock.settledResults.map(
      (r) => r.value,
    );
    expect(resultsArray).toEqual(["1", "1", "3", "4", "5"]);
  });

  it("no async results mix or overlap inside single interval if trying to create multiple intervals", async () => {
    // check sequential operations
    for (let i = 0; i < 10; i++) {
      const randMS = (Math.random() * 10 + 2) * 1000;
      const clear = CreateSafeIntervalMultiple(ResolveRandomlyMock, 1000, [
        randMS,
      ]);
      await PassTickAndWaitForResolve(1000);
      expect(ResolveRandomlyMock).toBeCalledTimes(1);
      expect(ResolveRandomlyMock).toHaveBeenCalledWith(randMS);
      expect(ResolveRandomlyMock).toHaveResolvedWith(randMS);
      ResolveRandomlyMock.mockClear();
      clear();
    }
  });
  it("no async results mix or overlap inside each interval from CreateSafeIntervalMultiple even if the async operation takes longer than the specified timeout", async () => {
    for (let i = 0; i < 10; i++) {
      const clear = CreateSafeIntervalMultiple(
        ResolveRandomlySingleIntervalMock,
        1000,
        [],
      );
      await PassTicksAndWaitForResolves(10, 1000);
      clear();
      expect(ResolveRandomlySingleIntervalMock).toBeCalledTimes(10);
      expect(expectedRandomMSArray).toEqual(actualRandomMSArray);
      ResolveRandomlySingleIntervalMock.mockClear();
      actualRandomMSArray.length = 0;
      expectedRandomMSArray.length = 0;
    }
  });
});

// createSafeTimeoutMultiple

describe("testing CreateSafeTimeoutMultiple with synchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("many timeouts for the same callable", async () => {
    // the callable should be called once for each timeout with the expected data
    // even with the same inputs and timeout
    const c1 = CreateSafeTimeoutMultiple(DataIdentityMock, 1000, ["1"]);
    const c2 = CreateSafeTimeoutMultiple(DataIdentityMock, 1000, ["1"]);
    const c3 = CreateSafeTimeoutMultiple(DataIdentityMock, 3000, ["3"]);
    const c4 = CreateSafeTimeoutMultiple(DataIdentityMock, 4000, ["4"]);
    const c5 = CreateSafeTimeoutMultiple(DataIdentityMock, 5000, ["5"]);
    await vi.advanceTimersByTimeAsync(5000);
    c1();
    c2();
    c3();
    c4();
    c5();
    expect(DataIdentityMock).toBeCalledTimes(5);
    const resultsArray = DataIdentityMock.mock.results.map((r) => r.value);
    expect(resultsArray).toEqual(["1", "1", "3", "4", "5"]);
  });
  it("timeouts stop and no callable is executed if the clear function is called before the timeout", async () => {
    const c1 = CreateSafeTimeoutMultiple(DataIdentityMock, 0, ["1"]);
    const c2 = CreateSafeTimeoutMultiple(DataIdentityMock, 1, ["1"]);
    const c3 = CreateSafeTimeoutMultiple(DataIdentityMock, 2, ["3"]);
    const c4 = CreateSafeTimeoutMultiple(DataIdentityMock, 3, ["4"]);
    const c5 = CreateSafeTimeoutMultiple(DataIdentityMock, 4, ["5"]);
    c1();
    c2();
    c3();
    c4();
    c5();
    await vi.advanceTimersByTimeAsync(50000);
    expect(DataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout and the timeout stops", async () => {
    const c1 = CreateSafeTimeoutMultiple(DataIdentityMock, 1, ["1"]);
    const c2 = CreateSafeTimeoutMultiple(DataIdentityMock, 1, ["1"]);
    const c3 = CreateSafeTimeoutMultiple(DataIdentityMock, 1, ["3"]);
    const c4 = CreateSafeTimeoutMultiple(DataIdentityMock, 1, ["4"]);
    const c5 = CreateSafeTimeoutMultiple(DataIdentityMock, 1, ["5"]);
    await vi.advanceTimersByTimeAsync(1);
    c1();
    c2();
    c3();
    c4();
    c5();
    await vi.advanceTimersByTimeAsync(50000);
    expect(DataIdentityMock).toBeCalledTimes(5);
    const resultsArray = DataIdentityMock.mock.results.map((r) => r.value);
    expect(resultsArray).toEqual(["1", "1", "3", "4", "5"]);
  });
  it("the callable is executed fully if the clear function is not called at all and the timeout stops", async () => {
    CreateSafeTimeoutMultiple(DataIdentityMock, 1, ["1"]);
    CreateSafeTimeoutMultiple(DataIdentityMock, 1, ["1"]);
    CreateSafeTimeoutMultiple(DataIdentityMock, 1, ["3"]);
    CreateSafeTimeoutMultiple(DataIdentityMock, 1, ["4"]);
    CreateSafeTimeoutMultiple(DataIdentityMock, 1, ["5"]);
    await vi.advanceTimersByTimeAsync(50000);
    expect(DataIdentityMock).toBeCalledTimes(5);
    const resultsArray = DataIdentityMock.mock.results.map((r) => r.value);
    expect(resultsArray).toEqual(["1", "1", "3", "4", "5"]);
  });
});

describe("testing CreateSafeTimeoutMultiple with asynchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("many timeouts for the same callable", async () => {
    // the callable should be called inside any created interval with the expected data
    // even with the same inputs and timeout
    const c1 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 1000, ["1"]);
    const c2 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 1000, ["1"]);
    const c3 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 3000, ["3"]);
    const c4 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 4000, ["4"]);
    const c5 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 5000, ["5"]);
    await PassTickAndWaitForResolve(5000);
    c1();
    c2();
    c3();
    c4();
    c5();
    expect(AsyncDataIdentityMock).toBeCalledTimes(5);
    const resultsArray = AsyncDataIdentityMock.mock.settledResults.map(
      (r) => r.value,
    );
    expect(resultsArray).toEqual(["1", "1", "3", "4", "5"]);
  });
  it("timeouts stop and no callable is executed if the clear function is called before the timeout", async () => {
    const c1 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 0, ["1"]);
    const c2 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 1, ["1"]);
    const c3 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 2, ["3"]);
    const c4 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 3, ["4"]);
    const c5 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 4, ["5"]);
    c1();
    c2();
    c3();
    c4();
    c5();
    await vi.advanceTimersByTimeAsync(50000);
    expect(AsyncDataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout and the timeout stops", async () => {
    const c1 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 1, ["1"]);
    const c2 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 1, ["1"]);
    const c3 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 1, ["3"]);
    const c4 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 1, ["4"]);
    const c5 = CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 1, ["5"]);
    await PassTickAndWaitForResolve(1);
    c1();
    c2();
    c3();
    c4();
    c5();
    await vi.advanceTimersByTimeAsync(50000);
    expect(AsyncDataIdentityMock).toBeCalledTimes(5);
    const resultsArray = AsyncDataIdentityMock.mock.settledResults.map(
      (r) => r.value,
    );
    expect(resultsArray).toEqual(["1", "1", "3", "4", "5"]);
  });

  it("the callable is executed fully if the clear function is not called at all and the timeout stops", async () => {
    CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 1, ["1"]);
    CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 1, ["1"]);
    CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 1, ["3"]);
    CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 1, ["4"]);
    CreateSafeTimeoutMultiple(AsyncDataIdentityMock, 1, ["5"]);
    await vi.advanceTimersByTimeAsync(50000);
    expect(AsyncDataIdentityMock).toBeCalledTimes(5);
    const resultsArray = AsyncDataIdentityMock.mock.settledResults.map(
      (r) => r.value,
    );
    expect(resultsArray).toEqual(["1", "1", "3", "4", "5"]);
  });
});
