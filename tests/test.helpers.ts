import { Cache } from "./src/index.js";

export const SpyOnCache = (cache: Cache, createSafeCache = false) => {
  if (createSafeCache) {
    // create safe cache is created once
    // to not overwrite it with many create safe multiple caches
    // make it a different cache
    SafeCache = cache;
  } else {
    // this one is going to be overwritten on every
    // create safe multiple call
    // so be ware
    SafeMultipleCache = cache;
  }
};

export let SafeCache: Cache = undefined;
export let SafeMultipleCache: Cache = undefined;

export const ClearCaches = () => {
  // clear the whole cache (leaving it with empty maps)
  if (SafeCache) {
    // doing it this way to not lose the link to
    // the original cache object
    SafeCache.ftc = new WeakMap();
    SafeCache.ftq = new WeakMap();
    SafeCache.ftl = new WeakMap();
    SafeCache.ftcb = new WeakMap();
  }
  if (SafeMultipleCache) {
    SafeMultipleCache.ftc = new WeakMap();
    SafeMultipleCache.ftq = new WeakMap();
    SafeMultipleCache.ftl = new WeakMap();
    SafeMultipleCache.ftcb = new WeakMap();
  }
};
