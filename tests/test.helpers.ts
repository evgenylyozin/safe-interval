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
    SafeCache.ftc = new Map();
    SafeCache.ftq = new Map();
    SafeCache.ftl = new Map();
    SafeCache.ftcb = new Map();
  }
  if (SafeMultipleCache) {
    SafeMultipleCache.ftc = new Map();
    SafeMultipleCache.ftq = new Map();
    SafeMultipleCache.ftl = new Map();
    SafeMultipleCache.ftcb = new Map();
  }
};

export const CountCacheKeys = (cache: Cache) => {
  return cache.ftc.size + cache.ftq.size + cache.ftl.size + cache.ftcb.size;
};
