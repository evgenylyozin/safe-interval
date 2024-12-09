import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateSafe, CreateSafeMultiple } from "../src/index.js";

const Arguments = [
  [], // test the function with 0 arguments
  ["5"], // test the function with 1 argument
  [[1, 2, 3], { hello: "world" }, "5", null, undefined], // test the function with multiple arguments
] as [unknown, unknown, unknown, unknown, unknown][]; // assertion to provide the typescript information on max num of arguments;
const DataIdentity = (
  a1?: unknown,
  a2?: unknown,
  a3?: unknown,
  a4?: unknown,
  a5?: unknown,
) => {
  return a3 ? a3 : a1 ? a1 : a2 ? a2 : a4 ? a4 : a5;
};

const DataIdentityMock = vi.fn(DataIdentity);

describe("testing CreateSafe as interval with synchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  for (const args of Arguments) {
    it("only one interval for the same callable", async () => {
      // the callable should be called once with the expected data
      // only one interval for the same callable
      // even with different inputs and timeout
      CreateSafe(DataIdentityMock, 0, ["1"], true);
      CreateSafe(DataIdentityMock, 100000, ["2"], true);
      CreateSafe(DataIdentityMock, 0, ["3"], true);
      CreateSafe(DataIdentityMock, 3, ["4"], true);
      const clear = CreateSafe(DataIdentityMock, 2000, args, true);
      await vi.advanceTimersToNextTimerAsync();
      expect(DataIdentityMock).toBeCalledTimes(1);
      expect(DataIdentityMock).toBeCalledWith(...args);
      expect(DataIdentityMock).toReturnWith(
        args.length > 1 ? args[2] : args.length > 0 ? args[0] : undefined,
      );
      clear();
    });
  }

  it("interval stops and no callable is executed if the clear function is called before the timeout", async () => {
    const clear = CreateSafe(DataIdentityMock, 5000, ["1000000"], true);
    clear();
    await vi.advanceTimersToNextTimerAsync();
    expect(DataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout", async () => {
    const clear = CreateSafe(DataIdentityMock, 5000, ["1000000"], true);
    await vi.advanceTimersByTimeAsync(5000);
    clear();
    expect(DataIdentityMock).toBeCalledTimes(1);
    expect(DataIdentityMock).toBeCalledWith("1000000");
    expect(DataIdentityMock).toReturnWith("1000000");
  });
  it("the callable is executed twice if the clear function is called after 2 timeouts passed, meaning the clear stops the interval after 2 ticks", async () => {
    const clear = CreateSafe(DataIdentityMock, 5000, [], true);
    await vi.advanceTimersByTimeAsync(10000);
    clear();
    await vi.advanceTimersByTimeAsync(1000000); // no more timers should be called
    expect(DataIdentityMock).toBeCalledTimes(2);
  });
});

const AsyncDataIdentity = async (
  a1?: unknown,
  a2?: unknown,
  a3?: unknown,
  a4?: unknown,
  a5?: unknown,
) => {
  return new Promise<unknown>((res) => {
    setTimeout(() => {
      res(a3 ? a3 : a1 ? a1 : a2 ? a2 : a4 ? a4 : a5);
    }, 1000);
  });
};
const AsyncDataIdentityMock = vi.fn(AsyncDataIdentity);
const ResolveInMS = async (ms: number) => {
  return new Promise<number>((res) => {
    setTimeout(() => {
      res(ms);
    }, ms);
  });
};
const ResolveInMSMock = vi.fn(ResolveInMS);

const expectedRandomMSArray: number[] = [];
const actualRandomMSArray: number[] = [];
const ResolveRandomly = vi.fn(async () => {
  const ms = (Math.random() * 10 + 2) * 1000;
  expectedRandomMSArray.push(ms);
  const result = await ResolveInMS(ms);
  actualRandomMSArray.push(result);
});

describe("testing CreateSafe as interval with asynchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  for (const args of Arguments) {
    it("only one interval for the same callable", async () => {
      // the callable should be called once with the expected data
      // only one interval for the same callable
      // even with different inputs and timeout
      CreateSafe(AsyncDataIdentityMock, 0, ["1"], true);
      CreateSafe(AsyncDataIdentityMock, 100000, ["2"], true);
      CreateSafe(AsyncDataIdentityMock, 0, ["3"], true);
      CreateSafe(AsyncDataIdentityMock, 3, ["4"], true);
      const clear = CreateSafe(AsyncDataIdentityMock, 2000, args, true);
      await vi.advanceTimersByTimeAsync(3000);
      clear();
      expect(AsyncDataIdentityMock).toBeCalledTimes(1);
      expect(AsyncDataIdentityMock).toBeCalledWith(...args);
      expect(AsyncDataIdentityMock).toHaveResolvedWith(
        args.length > 1 ? args[2] : args.length > 0 ? args[0] : undefined,
      );
    });
  }

  it("interval stops and no callable is executed if the clear function is called before the timeout", async () => {
    const clear = CreateSafe(AsyncDataIdentityMock, 5000, ["1000000"], true);
    clear();
    await vi.advanceTimersByTimeAsync(1000000);
    expect(AsyncDataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout", async () => {
    const clear = CreateSafe(AsyncDataIdentityMock, 5000, ["1000000"], true);
    await vi.advanceTimersByTimeAsync(6000);
    clear();
    expect(AsyncDataIdentityMock).toBeCalledTimes(1);
    expect(AsyncDataIdentityMock).toBeCalledWith("1000000");
  });
  it("the callable is executed twice if the clear function is called after 2 timeouts passed, meaning the clear stops the interval after 2 ticks", async () => {
    const clear = CreateSafe(ResolveRandomly, 5000, [], true);
    await vi.advanceTimersByTimeAsync(10000); // add 2 wrapped callables into the queue
    clear(); // remove the interval now
    await vi.advanceTimersByTimeAsync(1000000); // resolve the callables and wait more
    expect(ResolveRandomly).toBeCalledTimes(2);
    expect(ResolveRandomly).toHaveResolvedTimes(2);
  });
  it("no async results mix or overlap if trying to create multiple intervals", async () => {
    // check sequential operations
    for (let i = 0; i < 10; i++) {
      const ms = (Math.random() * 10 + 2) * 1000;
      const clear = CreateSafe(ResolveInMSMock, 1000, [ms], true);
      await vi.advanceTimersByTimeAsync(1000); // add to the queue
      clear(); // remove the interval here
      await vi.advanceTimersByTimeAsync(ms); // wait for the resolve
      expect(ResolveInMSMock).toBeCalledTimes(1);
      expect(ResolveInMSMock).toHaveBeenCalledWith(ms);
      expect(ResolveInMSMock).toHaveResolvedWith(ms);
      ResolveInMSMock.mockClear();
    }
    // check rewrite operations
    let lastms = 0;
    let clear = undefined;
    for (let i = 0; i < 10; i++) {
      const ms = (Math.random() * 10 + 2) * 1000;
      clear = CreateSafe(ResolveInMSMock, 1000, [ms], true);
      lastms = ms;
    }
    await vi.advanceTimersByTimeAsync(10000); // add 10 wrapped callables into the queue
    clear(); // remove the interval now
    await vi.advanceTimersByTimeAsync(1000000); // resolve the callables and wait more
    expect(ResolveInMSMock).toBeCalledTimes(10);
    expect(ResolveInMSMock).toHaveBeenNthCalledWith(10, lastms);
    expect(ResolveInMSMock).toHaveResolvedTimes(10);
    expect(ResolveInMSMock).toHaveNthResolvedWith(10, lastms);
    clear();
  });
  it("no async results mix or overlap inside single interval even if the async operation takes longer than the specified timeout", async () => {
    const clear = CreateSafe(ResolveRandomly, 1000, [], true);
    await vi.advanceTimersByTimeAsync(10000); // add 10 wrapped callables into the queue
    clear();
    await vi.advanceTimersByTimeAsync(1000000); // resolve the callables and wait more
    expect(ResolveRandomly).toBeCalledTimes(10);
    expect(expectedRandomMSArray).toEqual(actualRandomMSArray);
  });
});

describe("testing CreateSafe as timeout with synchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  for (const args of Arguments) {
    it("only one timeout for the same callable", async () => {
      // the callable should be called once with the expected data
      // only one timeout for the same callable
      // even with different inputs and timeout
      CreateSafe(DataIdentityMock, 0, ["1"], false);
      CreateSafe(DataIdentityMock, 100000, ["2"], false);
      CreateSafe(DataIdentityMock, 0, ["3"], false);
      CreateSafe(DataIdentityMock, 3, ["4"], false);
      const clear = CreateSafe(DataIdentityMock, 2000, args, false);
      await vi.advanceTimersToNextTimerAsync();
      expect(DataIdentityMock).toBeCalledTimes(1);
      expect(DataIdentityMock).toBeCalledWith(...args);
      expect(DataIdentityMock).toReturnWith(
        args.length > 1 ? args[2] : args.length > 0 ? args[0] : undefined,
      );
      clear();
    });
  }

  it("timeout stops and no callable is executed if the clear function is called before the timeout", async () => {
    const clear = CreateSafe(DataIdentityMock, 5000, ["1000000"], false);
    clear();
    await vi.advanceTimersToNextTimerAsync();
    expect(DataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout", async () => {
    const clear = CreateSafe(DataIdentityMock, 5000, ["1000000"], false);
    await vi.advanceTimersToNextTimerAsync();
    expect(DataIdentityMock).toBeCalledTimes(1);
    expect(DataIdentityMock).toBeCalledWith("1000000");
    expect(DataIdentityMock).toReturnWith("1000000");
    clear();
  });
});

describe("testing CreateSafe as timeout with asynchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  for (const args of Arguments) {
    it("only one timeout for the same callable", async () => {
      // the callable should be called once with the expected data
      // only one timeout for the same callable
      // even with different inputs and timeout
      CreateSafe(AsyncDataIdentityMock, 0, ["1"], false);
      CreateSafe(AsyncDataIdentityMock, 100000, ["2"], false);
      CreateSafe(AsyncDataIdentityMock, 0, ["3"], false);
      CreateSafe(AsyncDataIdentityMock, 3, ["4"], false);
      const clear = CreateSafe(AsyncDataIdentityMock, 2000, args, false);
      await vi.advanceTimersToNextTimerAsync();
      await vi.advanceTimersToNextTimerAsync(); // to make sure the promise is resolved
      expect(AsyncDataIdentityMock).toBeCalledTimes(1);
      expect(AsyncDataIdentityMock).toBeCalledWith(...args);
      expect(AsyncDataIdentityMock).toHaveResolvedWith(
        args.length > 1 ? args[2] : args.length > 0 ? args[0] : undefined,
      );
      clear();
    });
  }

  it("timeout stops and no callable is executed if the clear function is called before the timeout", async () => {
    const clear = CreateSafe(AsyncDataIdentityMock, 5000, ["1000000"], false);
    clear();
    await vi.advanceTimersToNextTimerAsync();
    expect(AsyncDataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout", async () => {
    const clear = CreateSafe(AsyncDataIdentityMock, 5000, ["1000000"], false);
    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync(); // to make sure the promise is resolved
    expect(AsyncDataIdentityMock).toBeCalledTimes(1);
    expect(AsyncDataIdentityMock).toBeCalledWith("1000000");
    clear();
  });
  it("no async results mix or overlap if trying to create multiple timeouts", async () => {
    const expectedResults: number[] = [];
    for (let i = 0; i < 10; i++) {
      const ms = (Math.random() * 10 + 2) * 1000;
      expectedResults.push(ms);
      const clear = CreateSafe(ResolveInMSMock, 1000, [ms], false);
      await vi.advanceTimersByTimeAsync(1000); // to start the callable
      clear();
    }

    await vi.advanceTimersByTimeAsync(100000); // to make sure the promises are resolved

    expect(ResolveInMSMock).toBeCalledTimes(10);
    expect(expectedResults).toEqual(
      ResolveInMSMock.mock.settledResults.map((r) => r.value),
    );
  });
  it("no async results mix or overlap inside single timeout even if the async operation takes longer than the specified timeout", async () => {
    for (let i = 0; i < 10; i++) {
      const clear = CreateSafe(ResolveRandomly, 1000, [], false); // here the timeout is created on every iteration since it is not an interval
      await vi.advanceTimersByTimeAsync(1000); // to start the callable
      clear();
    }

    await vi.advanceTimersByTimeAsync(100000); // to make sure the promises are resolved

    expect(ResolveRandomly).toBeCalledTimes(10);
    expect(expectedRandomMSArray).toEqual(actualRandomMSArray);
  });
});

// create safe interval multiple

describe("testing CreateSafeMultiple as interval with synchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  for (const args of Arguments) {
    it("many intervals for the same callable", async () => {
      // the callable should be called inside any created interval with the expected data
      // even with the same inputs and timeout
      const c1 = CreateSafeMultiple(DataIdentityMock, 1000, ["1"], true);
      const c2 = CreateSafeMultiple(DataIdentityMock, 1000, ["1"], true);
      const c3 = CreateSafeMultiple(DataIdentityMock, 3000, ["3"], true);
      const c4 = CreateSafeMultiple(DataIdentityMock, 4000, ["4"], true);
      const c5 = CreateSafeMultiple(DataIdentityMock, 5000, args, true); // this one checks the different arguments count
      await vi.advanceTimersByTimeAsync(5000);
      c1();
      c2();
      c3();
      c4();
      c5();
      expect(DataIdentityMock).toBeCalledTimes(13);
      const resultsArray = DataIdentityMock.mock.results.map((r) => r.value);
      expect(resultsArray).toEqual([
        "1",
        "1",
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
        args.length > 1 ? args[2] : args.length > 0 ? args[0] : undefined,
      ]);
    });
  }

  it("intervals stop and no callable is executed if the clear function is called before the timeout", async () => {
    const c1 = CreateSafeMultiple(DataIdentityMock, 0, ["1"], true);
    const c2 = CreateSafeMultiple(DataIdentityMock, 1, ["1"], true);
    const c3 = CreateSafeMultiple(DataIdentityMock, 2, ["3"], true);
    const c4 = CreateSafeMultiple(DataIdentityMock, 3, ["4"], true);
    const c5 = CreateSafeMultiple(DataIdentityMock, 4, ["5"], true);
    c1();
    c2();
    c3();
    c4();
    c5();
    await vi.advanceTimersByTimeAsync(50000);
    expect(DataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after 1 timeout", async () => {
    const c1 = CreateSafeMultiple(DataIdentityMock, 1, ["1"], true);
    const c2 = CreateSafeMultiple(DataIdentityMock, 1, ["1"], true);
    const c3 = CreateSafeMultiple(DataIdentityMock, 1, ["3"], true);
    const c4 = CreateSafeMultiple(DataIdentityMock, 1, ["4"], true);
    const c5 = CreateSafeMultiple(DataIdentityMock, 1, ["5"], true);
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
    const c1 = CreateSafeMultiple(DataIdentityMock, 1, ["1"], true);
    const c2 = CreateSafeMultiple(DataIdentityMock, 1, ["1"], true);
    const c3 = CreateSafeMultiple(DataIdentityMock, 1, ["3"], true);
    const c4 = CreateSafeMultiple(DataIdentityMock, 1, ["4"], true);
    const c5 = CreateSafeMultiple(DataIdentityMock, 1, ["5"], true);
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

describe("testing CreateSafeMultiple as interval with asynchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  for (const args of Arguments) {
    it("many intervals for the same callable", async () => {
      // the callable should be called inside any created interval with the expected data
      // even with the same inputs and timeout
      const c1 = CreateSafeMultiple(AsyncDataIdentityMock, 1000, ["1"], true); // these register 3 callbacks during 5 seconds and the last cb resolves because we wait for it in the PassTickAndWaitForResolve later
      const c2 = CreateSafeMultiple(AsyncDataIdentityMock, 1000, ["1"], true);
      const c3 = CreateSafeMultiple(AsyncDataIdentityMock, 3000, ["3"], true);
      const c4 = CreateSafeMultiple(AsyncDataIdentityMock, 4000, ["4"], true);
      const c5 = CreateSafeMultiple(AsyncDataIdentityMock, 5000, args, true);
      await vi.advanceTimersByTimeAsync(5000);
      c1();
      c2();
      c3();
      c4();
      c5();
      expect(AsyncDataIdentityMock).toBeCalledTimes(13);
      await vi.advanceTimersByTimeAsync(5000); // wait all promises resolve (any wait value will do)
      const resultsArray = AsyncDataIdentityMock.mock.settledResults.map(
        (r) => r.value,
      );
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
        args.length > 1 ? args[2] : args.length > 0 ? args[0] : undefined,
        "1",
        "1",
      ]);
    });
  }

  it("intervals stop and no callable is executed if the clear function is called before the timeout", async () => {
    const c1 = CreateSafeMultiple(AsyncDataIdentityMock, 0, ["1"], true);
    const c2 = CreateSafeMultiple(AsyncDataIdentityMock, 1, ["1"], true);
    const c3 = CreateSafeMultiple(AsyncDataIdentityMock, 2, ["3"], true);
    const c4 = CreateSafeMultiple(AsyncDataIdentityMock, 3, ["4"], true);
    const c5 = CreateSafeMultiple(AsyncDataIdentityMock, 4, ["5"], true);
    c1();
    c2();
    c3();
    c4();
    c5();
    await vi.advanceTimersByTimeAsync(50000);
    expect(AsyncDataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout", async () => {
    const c1 = CreateSafeMultiple(AsyncDataIdentityMock, 1, ["1"], true);
    const c2 = CreateSafeMultiple(AsyncDataIdentityMock, 1, ["1"], true);
    const c3 = CreateSafeMultiple(AsyncDataIdentityMock, 1, ["3"], true);
    const c4 = CreateSafeMultiple(AsyncDataIdentityMock, 1, ["4"], true);
    const c5 = CreateSafeMultiple(AsyncDataIdentityMock, 1, ["5"], true);
    await vi.advanceTimersByTimeAsync(1);
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

  it("no async results mix or overlap inside single interval if trying to create multiple intervals", async () => {
    // check sequential operations
    for (let i = 0; i < 10; i++) {
      const ms = (Math.random() * 10 + 2) * 1000;
      const clear = CreateSafeMultiple(ResolveInMSMock, 1000, [ms], true);
      await vi.advanceTimersByTimeAsync(1000);
      clear();
      await vi.advanceTimersByTimeAsync(ms);
      expect(ResolveInMSMock).toBeCalledTimes(1);
      expect(ResolveInMSMock).toHaveBeenCalledWith(ms);
      expect(ResolveInMSMock).toHaveResolvedWith(ms);
      ResolveInMSMock.mockClear();
    }
  });
  it("no async results mix or overlap inside each interval from CreateSafeMultiple even if the async operation takes longer than the specified timeout", async () => {
    for (let i = 0; i < 10; i++) {
      const clear = CreateSafeMultiple(ResolveRandomly, 1000, [], true);
      await vi.advanceTimersByTimeAsync(1000);
      clear();
      await vi.advanceTimersByTimeAsync(100000);
      expect(ResolveRandomly).toBeCalledTimes(1);
      expect(expectedRandomMSArray).toEqual(actualRandomMSArray);
      ResolveRandomly.mockClear();
      actualRandomMSArray.length = 0;
      expectedRandomMSArray.length = 0;
    }
  });
});

// CreateSafeMultiple

describe("testing CreateSafeMultiple as timeout with synchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  for (const args of Arguments) {
    it("many timeouts for the same callable", async () => {
      // the callable should be called once for each timeout with the expected data
      // even with the same inputs and timeout
      const c1 = CreateSafeMultiple(DataIdentityMock, 1000, ["1"], false);
      const c2 = CreateSafeMultiple(DataIdentityMock, 1000, ["1"], false);
      const c3 = CreateSafeMultiple(DataIdentityMock, 3000, ["3"], false);
      const c4 = CreateSafeMultiple(DataIdentityMock, 4000, ["4"], false);
      const c5 = CreateSafeMultiple(DataIdentityMock, 5000, args, false);
      await vi.advanceTimersByTimeAsync(5000);
      c1();
      c2();
      c3();
      c4();
      c5();
      expect(DataIdentityMock).toBeCalledTimes(5);
      const resultsArray = DataIdentityMock.mock.results.map((r) => r.value);
      expect(resultsArray).toEqual([
        "1",
        "1",
        "3",
        "4",
        args.length > 1 ? args[2] : args.length > 0 ? args[0] : undefined,
      ]);
    });
  }

  it("timeouts stop and no callable is executed if the clear function is called before the timeout", async () => {
    const c1 = CreateSafeMultiple(DataIdentityMock, 0, ["1"], false);
    const c2 = CreateSafeMultiple(DataIdentityMock, 1, ["1"], false);
    const c3 = CreateSafeMultiple(DataIdentityMock, 2, ["3"], false);
    const c4 = CreateSafeMultiple(DataIdentityMock, 3, ["4"], false);
    const c5 = CreateSafeMultiple(DataIdentityMock, 4, ["5"], false);
    c1();
    c2();
    c3();
    c4();
    c5();
    await vi.advanceTimersByTimeAsync(50000);
    expect(DataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout and the timeout stops", async () => {
    const c1 = CreateSafeMultiple(DataIdentityMock, 1, ["1"], false);
    const c2 = CreateSafeMultiple(DataIdentityMock, 1, ["1"], false);
    const c3 = CreateSafeMultiple(DataIdentityMock, 1, ["3"], false);
    const c4 = CreateSafeMultiple(DataIdentityMock, 1, ["4"], false);
    const c5 = CreateSafeMultiple(DataIdentityMock, 1, ["5"], false);
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
    CreateSafeMultiple(DataIdentityMock, 1, ["1"], false);
    CreateSafeMultiple(DataIdentityMock, 1, ["1"], false);
    CreateSafeMultiple(DataIdentityMock, 1, ["3"], false);
    CreateSafeMultiple(DataIdentityMock, 1, ["4"], false);
    CreateSafeMultiple(DataIdentityMock, 1, ["5"], false);
    await vi.advanceTimersByTimeAsync(50000);
    expect(DataIdentityMock).toBeCalledTimes(5);
    const resultsArray = DataIdentityMock.mock.results.map((r) => r.value);
    expect(resultsArray).toEqual(["1", "1", "3", "4", "5"]);
  });
});

describe("testing CreateSafeMultiple as timeout with asynchronous function with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  for (const args of Arguments) {
    it("many timeouts for the same callable", async () => {
      // the callable should be called inside any created interval with the expected data
      // even with the same inputs and timeout
      const c1 = CreateSafeMultiple(AsyncDataIdentityMock, 1000, ["1"], false);
      const c2 = CreateSafeMultiple(AsyncDataIdentityMock, 1000, ["1"], false);
      const c3 = CreateSafeMultiple(AsyncDataIdentityMock, 3000, ["3"], false);
      const c4 = CreateSafeMultiple(AsyncDataIdentityMock, 4000, ["4"], false);
      const c5 = CreateSafeMultiple(AsyncDataIdentityMock, 5000, args, false);
      await vi.advanceTimersByTimeAsync(6000);
      c1();
      c2();
      c3();
      c4();
      c5();
      expect(AsyncDataIdentityMock).toBeCalledTimes(5);
      const resultsArray = AsyncDataIdentityMock.mock.settledResults.map(
        (r) => r.value,
      );
      expect(resultsArray).toEqual([
        "1",
        "1",
        "3",
        "4",
        args.length > 1 ? args[2] : args.length > 0 ? args[0] : undefined,
      ]);
    });
  }

  it("timeouts stop and no callable is executed if the clear function is called before the timeout", async () => {
    const c1 = CreateSafeMultiple(AsyncDataIdentityMock, 0, ["1"], false);
    const c2 = CreateSafeMultiple(AsyncDataIdentityMock, 1, ["1"], false);
    const c3 = CreateSafeMultiple(AsyncDataIdentityMock, 2, ["3"], false);
    const c4 = CreateSafeMultiple(AsyncDataIdentityMock, 3, ["4"], false);
    const c5 = CreateSafeMultiple(AsyncDataIdentityMock, 4, ["5"], false);
    c1();
    c2();
    c3();
    c4();
    c5();
    await vi.advanceTimersByTimeAsync(50000);
    expect(AsyncDataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout and the timeout stops", async () => {
    const c1 = CreateSafeMultiple(AsyncDataIdentityMock, 1, ["1"], false);
    const c2 = CreateSafeMultiple(AsyncDataIdentityMock, 1, ["1"], false);
    const c3 = CreateSafeMultiple(AsyncDataIdentityMock, 1, ["3"], false);
    const c4 = CreateSafeMultiple(AsyncDataIdentityMock, 1, ["4"], false);
    const c5 = CreateSafeMultiple(AsyncDataIdentityMock, 1, ["5"], false);
    await vi.advanceTimersByTimeAsync(1);
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
    CreateSafeMultiple(AsyncDataIdentityMock, 1, ["1"], false);
    CreateSafeMultiple(AsyncDataIdentityMock, 1, ["1"], false);
    CreateSafeMultiple(AsyncDataIdentityMock, 1, ["3"], false);
    CreateSafeMultiple(AsyncDataIdentityMock, 1, ["4"], false);
    CreateSafeMultiple(AsyncDataIdentityMock, 1, ["5"], false);
    await vi.advanceTimersByTimeAsync(50000);
    expect(AsyncDataIdentityMock).toBeCalledTimes(5);
    const resultsArray = AsyncDataIdentityMock.mock.settledResults.map(
      (r) => r.value,
    );
    expect(resultsArray).toEqual(["1", "1", "3", "4", "5"]);
  });
});

describe("testing CreateSafe as interval with synchronous function with single argument the function is added after the timeout passes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("only one interval for the same callable even after the timeout", async () => {
    // the callable should be called two times with different data
    // the first one is when the first timeout passes
    // the second one and over is from the second timeout pass
    CreateSafe(DataIdentityMock, 0, ["1"], true);
    CreateSafe(DataIdentityMock, 100000, ["2"], true);
    CreateSafe(DataIdentityMock, 0, ["3"], true);
    CreateSafe(DataIdentityMock, 3, ["4"], true);
    CreateSafe(DataIdentityMock, 2000, ["5"], true);
    await vi.advanceTimersToNextTimerAsync(); // the first timeout should call the callable with 5
    expect(DataIdentityMock).toBeCalledTimes(1);
    expect(DataIdentityMock).toBeCalledWith("5");
    expect(DataIdentityMock).toReturnWith("5");
    CreateSafe(DataIdentityMock, 0, ["5"], true);
    CreateSafe(DataIdentityMock, 0, ["1000"], true);
    const clear = CreateSafe(DataIdentityMock, 3000, ["10"], true); // then the callable is registered with new data and interval
    await vi.advanceTimersByTimeAsync(10000); // here only 3 additional calls should be made and with 10 this time
    expect(DataIdentityMock).toBeCalledTimes(4);
    const resultsArray = DataIdentityMock.mock.results.map((r) => r.value);
    expect(resultsArray).toEqual(["5", "10", "10", "10"]);
    clear();
  });
});

describe("testing CreateSafe as timeout with synchronous function with single argument when the same callable is added after the timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("only one timeout for the same callable and new timeout for it after the timeout", async () => {
    CreateSafe(DataIdentityMock, 0, ["1"], false);
    CreateSafe(DataIdentityMock, 100000, ["2"], false);
    CreateSafe(DataIdentityMock, 0, ["3"], false);
    CreateSafe(DataIdentityMock, 3, ["4"], false);
    CreateSafe(DataIdentityMock, 2000, ["5"], false);
    await vi.advanceTimersToNextTimerAsync();
    expect(DataIdentityMock).toBeCalledTimes(1);
    expect(DataIdentityMock).toBeCalledWith("5");
    expect(DataIdentityMock).toReturnWith("5");
    CreateSafe(DataIdentityMock, 0, ["5"], false);
    CreateSafe(DataIdentityMock, 0, ["1000"], false);
    const clear = CreateSafe(DataIdentityMock, 3000, ["10"], false);
    await vi.advanceTimersByTimeAsync(10000);
    expect(DataIdentityMock).toBeCalledTimes(2);
    const resultsArray = DataIdentityMock.mock.results.map((r) => r.value);
    expect(resultsArray).toEqual(["5", "10"]);
    clear();
  });
});

// different functions should result in different timeouts and intervals for safe interval and safe timeout

const DataIdentity2 = (
  a1?: unknown,
  a2?: unknown,
  a3?: unknown,
  a4?: unknown,
  a5?: unknown,
) => {
  return a3 ? a3 : a1 ? a1 : a2 ? a2 : a4 ? a4 : a5;
};

const DataIdentity2Mock = vi.fn(DataIdentity2);

describe("testing CreateSafe as interval with different functions with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  for (const args of Arguments) {
    it("two different intervals for different callables", async () => {
      CreateSafe(DataIdentityMock, 0, ["1"], true);
      CreateSafe(DataIdentityMock, 100000, ["2"], true);
      CreateSafe(DataIdentityMock, 0, ["3"], true);
      CreateSafe(DataIdentityMock, 3, ["4"], true);
      const clear = CreateSafe(DataIdentityMock, 2000, args, true);

      CreateSafe(DataIdentity2Mock, 0, ["1"], true);
      CreateSafe(DataIdentity2Mock, 100000, ["2"], true);
      CreateSafe(DataIdentity2Mock, 0, ["3"], true);
      CreateSafe(DataIdentity2Mock, 3, ["4"], true);
      const clear2 = CreateSafe(DataIdentity2Mock, 2000, args, true);

      await vi.advanceTimersToNextTimerAsync();

      expect(DataIdentityMock).toBeCalledTimes(1);
      expect(DataIdentityMock).toBeCalledWith(...args);
      expect(DataIdentityMock).toReturnWith(
        args.length > 1 ? args[2] : args.length > 0 ? args[0] : undefined,
      );

      expect(DataIdentity2Mock).toBeCalledTimes(1);
      expect(DataIdentity2Mock).toBeCalledWith(...args);
      expect(DataIdentity2Mock).toReturnWith(
        args.length > 1 ? args[2] : args.length > 0 ? args[0] : undefined,
      );
      clear();
      clear2();
      await vi.advanceTimersByTimeAsync(10000);
      // expect the intervals to be cleared for both callables
      expect(DataIdentityMock).toBeCalledTimes(1);
      expect(DataIdentity2Mock).toBeCalledTimes(1);
    });
  }
});

describe("testing CreateSafe as timeout with different functions with single argument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  for (const args of Arguments) {
    it("two different timeouts for different callables", async () => {
      CreateSafe(DataIdentityMock, 0, ["1"], false);
      CreateSafe(DataIdentityMock, 100000, ["2"], false);
      CreateSafe(DataIdentityMock, 0, ["3"], false);
      CreateSafe(DataIdentityMock, 3, ["4"], false);
      const clear = CreateSafe(DataIdentityMock, 2000, args, false);

      CreateSafe(DataIdentity2Mock, 0, ["1"], false);
      CreateSafe(DataIdentity2Mock, 100000, ["2"], false);
      CreateSafe(DataIdentity2Mock, 0, ["3"], false);
      CreateSafe(DataIdentity2Mock, 3, ["4"], false);
      const clear2 = CreateSafe(DataIdentity2Mock, 2000, args, false);

      await vi.advanceTimersToNextTimerAsync();
      expect(DataIdentityMock).toBeCalledTimes(1);
      expect(DataIdentityMock).toBeCalledWith(...args);
      expect(DataIdentityMock).toReturnWith(
        args.length > 1 ? args[2] : args.length > 0 ? args[0] : undefined,
      );

      expect(DataIdentity2Mock).toBeCalledTimes(1);
      expect(DataIdentity2Mock).toBeCalledWith(...args);
      expect(DataIdentity2Mock).toReturnWith(
        args.length > 1 ? args[2] : args.length > 0 ? args[0] : undefined,
      );

      await vi.advanceTimersByTimeAsync(10000);
      // expect no more callables to be executed even without the clear call
      expect(DataIdentityMock).toBeCalledTimes(1);
      expect(DataIdentity2Mock).toBeCalledTimes(1);

      // expect no errors on expired clear calls

      clear();
      clear2();
    });
  }
});

// callback usage tests
const randNumArr = [];
const ResolveAndReturnMock = vi.fn(async () => {
  const randNum = Math.random() * 10;
  randNumArr.push(randNum);
  return (await AsyncDataIdentity(randNum)) as number;
});

const Callback = (n: number) => {
  return n;
};
const OtherCallback = (n: number) => {
  return n + 1;
};

const CallbackMock = vi.fn(Callback);
const OtherCallbackMock = vi.fn(OtherCallback);

describe("testing callback usage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("callback is called for each interval in CreateSafe", async () => {
    const clear = CreateSafe(
      ResolveAndReturnMock,
      1000,
      [],
      true,
      CallbackMock,
    );
    await vi.advanceTimersByTimeAsync(10000); // add 10 wrapped callables to the queue
    clear();
    await vi.advanceTimersByTimeAsync(10000); // wait till the last promise resolves
    // expect the mock to be called 10 times and be invoked with the same values as stored in the randNumArr
    expect(CallbackMock).toBeCalledTimes(10);
    CallbackMock.mock.calls.forEach((c, i) => {
      expect(c[0]).toBe(randNumArr[i]);
    });
    const resultsArray = CallbackMock.mock.results.map((r) => r.value);
    expect(resultsArray).toEqual(randNumArr);
    randNumArr.length = 0;
  });
  it("callback is called for each interval in CreateSafeMultiple", async () => {
    const clear = CreateSafeMultiple(
      ResolveAndReturnMock,
      1000,
      [],
      true,
      CallbackMock,
    );
    await vi.advanceTimersByTimeAsync(10000);
    clear();
    await vi.advanceTimersByTimeAsync(1000);
    // expect the mock to be called 10 times and be invoked with the same values as stored in the randNumArr
    expect(CallbackMock).toBeCalledTimes(10);
    CallbackMock.mock.calls.forEach((c, i) => {
      expect(c[0]).toBe(randNumArr[i]);
    });
    const resultsArray = CallbackMock.mock.results.map((r) => r.value);
    expect(resultsArray).toEqual(randNumArr);
    randNumArr.length = 0;
  });
  it("callback is called for each timeout in CreateSafe", async () => {
    for (let i = 0; i < 10; i++) {
      const clear = CreateSafe(
        ResolveAndReturnMock,
        1000,
        [],
        false,
        CallbackMock,
      );
      await vi.advanceTimersByTimeAsync(1000);
      clear();
      await vi.advanceTimersByTimeAsync(1000);
    }
    // expect the mock to be called 10 times and be invoked with the same values as stored in the randNumArr
    expect(CallbackMock).toBeCalledTimes(10);
    CallbackMock.mock.calls.forEach((c, i) => {
      expect(c[0]).toBe(randNumArr[i]);
    });
    const resultsArray = CallbackMock.mock.results.map((r) => r.value);
    expect(resultsArray).toEqual(randNumArr);
    randNumArr.length = 0;
  });
  it("callback is called for each timeout in CreateSafeMultiple", async () => {
    for (let i = 0; i < 10; i++) {
      const clear = CreateSafeMultiple(
        ResolveAndReturnMock,
        1000,
        [],
        false,
        CallbackMock,
      );
      await vi.advanceTimersByTimeAsync(1000);
      clear();
      await vi.advanceTimersByTimeAsync(1000);
    }
    // expect the mock to be called 10 times and be invoked with the same values as stored in the randNumArr
    expect(CallbackMock).toBeCalledTimes(10);
    CallbackMock.mock.calls.forEach((c, i) => {
      expect(c[0]).toBe(randNumArr[i]);
    });
    const resultsArray = CallbackMock.mock.results.map((r) => r.value);
    expect(resultsArray).toEqual(randNumArr);
    randNumArr.length = 0;
  });
  it("callback is deregistered on new callback supply for SafeInterval", async () => {
    CreateSafe(ResolveAndReturnMock, 1000, [], true, CallbackMock);
    const clear = CreateSafe(
      ResolveAndReturnMock,
      1000,
      [],
      true,
      OtherCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(10000);
    clear();
    await vi.advanceTimersByTimeAsync(10000);
    // expect the CallbackMock not called and OtherCallbackMock called 10 times
    expect(CallbackMock).toBeCalledTimes(0);
    expect(OtherCallbackMock).toBeCalledTimes(10);
  });
  it("callback is deregistered on new callback supply for SafeTimeout", async () => {
    CreateSafe(ResolveAndReturnMock, 1000, [], false, CallbackMock);
    CreateSafe(ResolveAndReturnMock, 1000, [], false, OtherCallbackMock);
    await vi.advanceTimersByTimeAsync(10000);
    // expect the CallbackMock not called and OtherCallbackMock called 1 time
    expect(CallbackMock).toBeCalledTimes(0);
    expect(OtherCallbackMock).toBeCalledTimes(1);
  });
  it("if the callable is pushed on the stack but the callback is deregistered => the new callback is called after the callable resolves in SafeInterval", async () => {
    CreateSafe(ResolveAndReturnMock, 1000, [], true, CallbackMock);
    // add the wrapped callable to the queue
    await vi.advanceTimersByTimeAsync(1000);
    // swap the callback
    const clear = CreateSafe(
      ResolveAndReturnMock,
      1000,
      [],
      true,
      OtherCallbackMock,
    );
    clear();
    await vi.advanceTimersByTimeAsync(1000); // wait till the first callable resolves
    // expect the CallbackMock not called and OtherCallbackMock called 1 time
    expect(CallbackMock).toBeCalledTimes(0);
    expect(OtherCallbackMock).toBeCalledTimes(1);
  });
  it("if the callable is pushed on the stack but the callback is deregistered => the new callback is called after the callable resolves in SafeTimeout", async () => {
    CreateSafe(ResolveAndReturnMock, 1000, [], false, CallbackMock);
    // wait till the callable is pushed on the stack
    await vi.advanceTimersByTimeAsync(1000);
    // swap the callback
    const clear = CreateSafe(
      ResolveAndReturnMock,
      1000,
      [],
      false,
      OtherCallbackMock,
    );
    await vi.advanceTimersToNextTimerAsync(); // wait till the first callable resolves
    clear();
    // expect the CallbackMock not called and OtherCallbackMock called 1 time
    expect(CallbackMock).toBeCalledTimes(0);
    expect(OtherCallbackMock).toBeCalledTimes(1);
  });
});

// REJECTS AND ERROR THROWS
const ErrorThrow = () => {
  try {
    throw new Error("error");
  } catch (e) {
    // handle the error in the callable or the script will crash
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    e;
  }
};
const ErrorThrowMock = vi.fn(ErrorThrow);

// reject in terms of handling are the same as errors
const Reject = async () => {
  try {
    await Promise.reject("reject");
  } catch (e) {
    // handle the error in the callable or the script will crash
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    e;
  }
};
const RejectMock = vi.fn(Reject);

const IdentityCallback = (v: unknown) => v;
const IdentityCallbackMock = vi.fn(IdentityCallback);

const ErrorThrowWithReturn = () => {
  try {
    throw new Error("error");
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    e;
    return 1;
  }
};
const ErrorThrowWithReturnMock = vi.fn(ErrorThrowWithReturn);

const RejectWithReturn = async () => {
  try {
    await Promise.reject("reject");
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    e;
    return 1;
  }
};
const RejectWithReturnMock = vi.fn(RejectWithReturn);

describe("testing rejects and error throws", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("error thrown in safe interval if caught in the callable then interval proceeds", async () => {
    const clear = CreateSafe(ErrorThrowMock, 1000, [], true);
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(ErrorThrowMock).toBeCalledTimes(2);
  });
  it("error thrown in safe timeout if caught in the callable then timeout finishes successfully", async () => {
    const clear = CreateSafe(ErrorThrowMock, 1000, [], false);
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(ErrorThrowMock).toBeCalledTimes(1);
  });
  it("error thrown in safe interval multiple if caught in the callable then interval proceeds", async () => {
    const clear = CreateSafeMultiple(ErrorThrowMock, 1000, [], true);
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(ErrorThrowMock).toBeCalledTimes(2);
  });
  it("error thrown in safe timeout multiple if caught in the callable then timeout finishes successfully", async () => {
    const clear = CreateSafeMultiple(ErrorThrowMock, 1000, [], false);
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(ErrorThrowMock).toBeCalledTimes(1);
  });
  it("reject in safe interval if caught in the callable then interval proceeds", async () => {
    const clear = CreateSafe(RejectMock, 1000, [], true);
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(RejectMock).toBeCalledTimes(2);
  });
  it("reject in safe timeout if caught in the callable then timeout finishes successfully", async () => {
    const clear = CreateSafe(RejectMock, 1000, [], false);
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(RejectMock).toBeCalledTimes(1);
  });
  it("reject in safe interval multiple if caught in the callable then interval proceeds", async () => {
    const clear = CreateSafeMultiple(RejectMock, 1000, [], true);
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(RejectMock).toBeCalledTimes(2);
  });
  it("reject in safe timeout multiple if caught in the callable then timeout finishes successfully", async () => {
    const clear = CreateSafeMultiple(RejectMock, 1000, [], false);
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(RejectMock).toBeCalledTimes(1);
  });
  // the throws and rejects are not resolved values so the callback function if any will be called with undefined instead of the resolved value
  it("error thrown in safe interval if caught in the callable and the callable not returning any value after that then the callback should be called with undefined", async () => {
    const clear = CreateSafe(
      ErrorThrowMock,
      1000,
      [],
      true,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(2);
    expect(IdentityCallbackMock).toBeCalledWith(undefined);
  });
  it("error thrown in safe timeout if caught in the callable and the callable not returning any value after that then the callback should be called with undefined", async () => {
    const clear = CreateSafe(
      ErrorThrowMock,
      1000,
      [],
      false,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledWith(undefined);
  });
  it("error thrown in safe interval multiple if caught in the callable and the callable not returning any value after that then the callback should be called with undefined", async () => {
    const clear = CreateSafeMultiple(
      ErrorThrowMock,
      1000,
      [],
      true,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(2);
    expect(IdentityCallbackMock).toBeCalledWith(undefined);
  });
  it("error thrown in safe timeout multiple if caught in the callable and the callable not returning any value after that then the callback should be called with undefined", async () => {
    const clear = CreateSafeMultiple(
      ErrorThrowMock,
      1000,
      [],
      false,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledWith(undefined);
  });
  // the same for rejects
  it("reject in safe interval if caught in the callable and the callable not returning any value after that then the callback should be called with undefined", async () => {
    const clear = CreateSafe(RejectMock, 1000, [], true, IdentityCallbackMock);
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(2);
    expect(IdentityCallbackMock).toBeCalledWith(undefined);
  });
  it("reject in safe timeout if caught in the callable and the callable not returning any value after that then the callback should be called with undefined", async () => {
    const clear = CreateSafe(RejectMock, 1000, [], false, IdentityCallbackMock);
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledWith(undefined);
  });
  it("reject in safe interval multiple if caught in the callable and the callable not returning any value after that then the callback should be called with undefined", async () => {
    const clear = CreateSafeMultiple(
      RejectMock,
      1000,
      [],
      true,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(2);
    expect(IdentityCallbackMock).toBeCalledWith(undefined);
  });
  it("reject in safe timeout multiple if caught in the callable and the callable not returning any value after that then the callback should be called with undefined", async () => {
    const clear = CreateSafeMultiple(
      RejectMock,
      1000,
      [],
      false,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledWith(undefined);
  });
  // if the callable handles an error and returns some value then this value should be passed to the callback if defined
  it("error thrown in safe interval if caught in the callable and the callable returns a value then the callback should be called with that value", async () => {
    const clear = CreateSafe(
      ErrorThrowWithReturnMock,
      1000,
      [],
      true,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(2);
    expect(IdentityCallbackMock).toBeCalledWith(1);
  });
  it("error thrown in safe timeout if caught in the callable and the callable returns a value then the callback should be called with that value", async () => {
    const clear = CreateSafe(
      ErrorThrowWithReturnMock,
      1000,
      [],
      false,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledWith(1);
  });
  it("error thrown in safe interval multiple if caught in the callable and the callable returns a value then the callback should be called with that value", async () => {
    const clear = CreateSafeMultiple(
      ErrorThrowWithReturnMock,
      1000,
      [],
      true,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(2);
    expect(IdentityCallbackMock).toBeCalledWith(1);
  });
  it("error thrown in safe timeout multiple if caught in the callable and the callable returns a value then the callback should be called with that value", async () => {
    const clear = CreateSafeMultiple(
      ErrorThrowWithReturnMock,
      1000,
      [],
      false,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledWith(1);
  });
  // the same for rejects
  it("reject in safe interval if caught in the callable and the callable returns a value then the callback should be called with that value", async () => {
    const clear = CreateSafe(
      RejectWithReturnMock,
      1000,
      [],
      true,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(2);
    expect(IdentityCallbackMock).toBeCalledWith(1);
  });
  it("reject in safe timeout if caught in the callable and the callable returns a value then the callback should be called with that value", async () => {
    const clear = CreateSafe(
      RejectWithReturnMock,
      1000,
      [],
      false,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledWith(1);
  });
  it("reject in safe interval multiple if caught in the callable and the callable returns a value then the callback should be called with that value", async () => {
    const clear = CreateSafeMultiple(
      RejectWithReturnMock,
      1000,
      [],
      true,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(2);
    expect(IdentityCallbackMock).toBeCalledWith(1);
  });
  it("reject in safe timeout multiple if caught in the callable and the callable returns a value then the callback should be called with that value", async () => {
    const clear = CreateSafeMultiple(
      RejectWithReturnMock,
      1000,
      [],
      false,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(2000);
    clear();
    expect(IdentityCallbackMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledWith(1);
  });
});

describe("testing no shuffle of results on callable set for execution and newly registered", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("on safe interval no shuffle", async () => {
    CreateSafe(ResolveInMSMock, 1, [10000], true, IdentityCallbackMock);
    await vi.advanceTimersByTimeAsync(1); // here the Mock should be in the queue
    CreateSafe(ResolveInMSMock, 1, [1000], true, IdentityCallbackMock);
    await vi.advanceTimersByTimeAsync(1); // here the next mock should be added to the queue too but not on the stack
    const clear = CreateSafe(
      ResolveInMSMock,
      1,
      [500],
      true,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(1); // the third is as the second one
    clear();
    expect(ResolveInMSMock).toBeCalledTimes(1); // only the first one should be on the stack by now
    expect(IdentityCallbackMock).toBeCalledTimes(0); // no calls to the callback yet since the first one hasn't been resolved yet
    await vi.advanceTimersByTime(2000); // no matter the time for the second and the third call passed the first one is not resolved so the second and the third ones should not be even on the stack yet
    expect(ResolveInMSMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledTimes(0);
    await vi.advanceTimersByTimeAsync(8000); // now the first one is resolved and the second one should be set on the stack
    expect(ResolveInMSMock).toBeCalledTimes(2);
    expect(IdentityCallbackMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledWith(10000);
    await vi.advanceTimersByTimeAsync(1000); // now the second one is resolved and the third one should be set on the stack
    expect(ResolveInMSMock).toBeCalledTimes(3);
    expect(IdentityCallbackMock).toBeCalledTimes(2);
    expect(IdentityCallbackMock).toBeCalledWith(1000);
    await vi.advanceTimersByTimeAsync(500); // finally the third one is resolved
    expect(ResolveInMSMock).toBeCalledTimes(3);
    expect(IdentityCallbackMock).toBeCalledTimes(3);
    expect(IdentityCallbackMock).toBeCalledWith(500);
  });
  it("on safe timeout no shuffle", async () => {
    CreateSafe(ResolveInMSMock, 0, [10000], false, IdentityCallbackMock);
    await vi.advanceTimersByTimeAsync(1); // here the Mock should be already on the stack but not resolved yet
    CreateSafe(ResolveInMSMock, 0, [1000], false, IdentityCallbackMock);
    await vi.advanceTimersByTimeAsync(1); // here the next mock should not be on the stack yet since the previous one is not resolved yet
    const clear = CreateSafe(
      ResolveInMSMock,
      0,
      [500],
      false,
      IdentityCallbackMock,
    );
    await vi.advanceTimersByTimeAsync(1); // here the next mock should not be on the stack yet since the previous one is not resolved yet
    expect(ResolveInMSMock).toBeCalledTimes(1); // only the first one should be on the stack by now
    expect(IdentityCallbackMock).toBeCalledTimes(0); // no calls to the callback yet since the first one hasn't been resolved yet
    await vi.advanceTimersByTime(2000); // no matter the time for the second and the third call passed the first one is not resolved so the second and the third ones should not be even on the stack yet
    expect(ResolveInMSMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledTimes(0);
    await vi.advanceTimersByTimeAsync(8000); // now the first one is resolved and the second one should be set on the stack
    expect(ResolveInMSMock).toBeCalledTimes(2);
    expect(IdentityCallbackMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledWith(10000);
    await vi.advanceTimersByTimeAsync(1000); // now the second one is resolved and the third one should be set on the stack
    expect(ResolveInMSMock).toBeCalledTimes(3);
    expect(IdentityCallbackMock).toBeCalledTimes(2);
    expect(IdentityCallbackMock).toBeCalledWith(1000);
    await vi.advanceTimersByTimeAsync(500); // finally the third one is resolved
    expect(ResolveInMSMock).toBeCalledTimes(3);
    expect(IdentityCallbackMock).toBeCalledTimes(3);
    expect(IdentityCallbackMock).toBeCalledWith(500);
    clear();
  });
});

describe("testing remove queue feature, if the queue is due to be removed then the callable should not be executed even if scheduled by timeout or interval only the first call should be executed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("no more than 1 call on safe interval", async () => {
    const clear = CreateSafe(
      ResolveInMSMock,
      1,
      [10000],
      true,
      IdentityCallbackMock,
      true,
    );
    await vi.advanceTimersByTimeAsync(10); // schedule 10 calls
    // by this time the first wrapped callable has started executing, no way stopping it now so 1 call should be done anyway
    clear();
    await vi.advanceTimersByTimeAsync(1000000); // but other calls should be discarded
    expect(ResolveInMSMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledTimes(1); // the callback should be called too since the call was made
  });
  it("no more than 1 call on safe timeout", async () => {
    // this one is mainly just to make sure the withQueue feature is working
    // seamlessly on the timeout
    // the queue anyway has only 1 call here
    const clear = CreateSafe(
      ResolveInMSMock,
      1,
      [10000],
      false,
      IdentityCallbackMock,
      true,
    );
    await vi.advanceTimersByTimeAsync(10); // schedule 1 call
    // by this time the first wrapped callable has started executing, no way stopping it now so 1 call should be done anyway
    clear();
    await vi.advanceTimersByTimeAsync(1000000);
    expect(ResolveInMSMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledTimes(1); // the callback should be called too since the call was made
  });
  it("no more than 1 call on safe interval multiple", async () => {
    const clear = CreateSafeMultiple(
      ResolveInMSMock,
      1,
      [10000],
      true,
      IdentityCallbackMock,
      true,
    );
    await vi.advanceTimersByTimeAsync(10); // schedule 10 calls
    // by this time the first wrapped callable has started executing, no way stopping it now so 1 call should be done anyway
    clear();
    await vi.advanceTimersByTimeAsync(1000000); // but other calls should be discarded
    expect(ResolveInMSMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledTimes(1); // the callback should be called too since the call was made
  });
  it("no more than 1 call on safe timeout multiple", async () => {
    // this one is mainly just to make sure the withQueue feature is working
    const clear = CreateSafeMultiple(
      ResolveInMSMock,
      1,
      [10000],
      false,
      IdentityCallbackMock,
      true,
    );
    await vi.advanceTimersByTimeAsync(10); // schedule 1 call
    // by this time the first wrapped callable has started executing, no way stopping it now so 1 call should be done anyway
    clear();
    await vi.advanceTimersByTimeAsync(1000000);
    expect(ResolveInMSMock).toBeCalledTimes(1);
    expect(IdentityCallbackMock).toBeCalledTimes(1); // the callback should be called too since the call was made
  });
  // reregistering should work the same way if the withQueue flag is true
  it("no more than 1 call on safe interval for the first callable with reregister", async () => {
    CreateSafe(ResolveInMSMock, 1, [10000], true, IdentityCallbackMock, true);
    await vi.advanceTimersByTimeAsync(10); // schedule 10 calls
    CreateSafe(
      ResolveInMSMock,
      1000,
      [20000],
      true,
      IdentityCallbackMock,
      true,
    );
    // here we expect that the ResolveInMSMock is called with 10000 only once
    // and then is called only with 20000
    await vi.advanceTimersByTimeAsync(160000);
    expect(ResolveInMSMock).toHaveBeenNthCalledWith(1, 10000);
    expect(ResolveInMSMock).toHaveBeenNthCalledWith(2, 20000);
    expect(ResolveInMSMock).toHaveBeenNthCalledWith(3, 20000);
    expect(ResolveInMSMock).toHaveBeenNthCalledWith(4, 20000);
    expect(ResolveInMSMock).toHaveBeenNthCalledWith(5, 20000);
  });
  // reregistering for safe timeout doesn't make any change => the call should be only 1 anyway
  // reregistering for multiples is not a thing at all so no other tests here
});
