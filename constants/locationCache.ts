export type CachedLocation = { latitude: number; longitude: number } | null;

let _cache: CachedLocation = null;

export const setCachedLocation = (loc: { latitude: number; longitude: number }) => {
  _cache = loc;
};

export const getCachedLocation = (): CachedLocation => _cache;
