import { Cache, Callable } from "./index.js";

export const CheckTestENV = () => {
  if (
    !process ||
    !process.env ||
    !process.env.TEST_ENVIRONMENT ||
    process.env.TEST_ENVIRONMENT !== "enabled"
  ) {
    return false;
  }
  return true;
};

export const SpyOnCache = (cache: Cache, createSafeCache = false) => {
  if (CheckTestENV()) {
    console.log("SPYING ON CACHE");
    if (createSafeCache) {
      // create safe cache is created once
      // to not overwrite it with many create safe multiple caches
      // make it a different cache
      CreateSafeCache = cache;
    }
  } else {
    // this one is going to be overwritten on every
    // create safe multiple call
    // so be ware
    CreateSafeMultipleCache = cache;
  }
};

export let CreateSafeCache: Cache = undefined;
export let CreateSafeMultipleCache: Cache = undefined;

export const ClearQueueForCallable = (
  callable: Callable,
  createSafeCache = false,
) => {
  if (CheckTestENV()) {
    if (createSafeCache) {
      CreateSafeCache.ftq.delete(callable);
    } else {
      CreateSafeMultipleCache.ftq.delete(callable);
    }
  }
};
