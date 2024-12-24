import { Cache } from "./index.js";

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

export const ClearCaches = () => {
  if (CheckTestENV()) {
    // clear the whole cache (leaving it with empty maps)
    console.log("CLEARING CACHES");
    if (CreateSafeCache) {
      // doing it this way to not lose the link to
      // the original cache object
      CreateSafeCache.ftc = new WeakMap();
      CreateSafeCache.ftq = new WeakMap();
      CreateSafeCache.ftl = new WeakMap();
      CreateSafeCache.ftcb = new WeakMap();
    }
    if (CreateSafeMultipleCache) {
      CreateSafeMultipleCache.ftc = new WeakMap();
      CreateSafeMultipleCache.ftq = new WeakMap();
      CreateSafeMultipleCache.ftl = new WeakMap();
      CreateSafeMultipleCache.ftcb = new WeakMap();
    }
  }
};
