import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateSafeInterval } from "../src/index.js";

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
    await vi.advanceTimersToNextTimerAsync();
    expect(DataIdentityMock).toBeCalledTimes(1);
    expect(DataIdentityMock).toBeCalledWith("1000000");
    expect(DataIdentityMock).toReturnWith("1000000");
    clear();
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
  const result = await ResolveRandomly(randMS);
  expectedRandomMSArray.push(randMS);
  actualRandomMSArray.push(result);
});

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
    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync(); // to make sure the promise is resolved
    expect(AsyncDataIdentityMock).toBeCalledTimes(1);
    expect(AsyncDataIdentityMock).toBeCalledWith("5");
    expect(AsyncDataIdentityMock).toHaveResolvedWith("5");
    clear();
  });
  it("interval stops and no callable is executed if the clear function is called before the timeout", async () => {
    const clear = CreateSafeInterval(AsyncDataIdentityMock, 5000, ["1000000"]);
    clear();
    await vi.advanceTimersToNextTimerAsync();
    expect(AsyncDataIdentityMock).toBeCalledTimes(0);
  });
  it("the callable is executed fully if the clear function is called after the timeout", async () => {
    const clear = CreateSafeInterval(AsyncDataIdentityMock, 5000, ["1000000"]);
    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync(); // to make sure the promise is resolved
    expect(AsyncDataIdentityMock).toBeCalledTimes(1);
    expect(AsyncDataIdentityMock).toBeCalledWith("1000000");
    clear();
  });
  it("no async results mix or overlap if trying to create multiple intervals", async () => {
    for (let i = 0; i < 10; i++) {
      const randMS = (Math.random() * 10 + 2) * 1000;
      const clear = CreateSafeInterval(ResolveRandomlyMock, 1000, [randMS]);
      await vi.advanceTimersToNextTimerAsync(); // to start the callable
      await vi.advanceTimersToNextTimerAsync(); // to make sure the promise is resolved
      expect(ResolveRandomlyMock).toBeCalledTimes(1);
      expect(ResolveRandomlyMock).toHaveBeenCalledWith(randMS);
      expect(ResolveRandomlyMock).toHaveResolvedWith(randMS);
      ResolveRandomlyMock.mockClear();
      clear();
    }
  });
  it("no async results mix or overlap inside single interval even if the async operation takes longer than the specified timeout", async () => {
    const clear = CreateSafeInterval(
      ResolveRandomlySingleIntervalMock,
      1000,
      [],
    );
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersToNextTimerAsync(); // to start the callable
      await vi.advanceTimersToNextTimerAsync(); // to make sure the promise is resolved
    }
    expect(ResolveRandomlySingleIntervalMock).toBeCalledTimes(10);
    expect(expectedRandomMSArray).toEqual(actualRandomMSArray);
    clear();
  });
});
