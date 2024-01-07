import * as R from 'ramda';

export const hash_cyrb53 = (str: string, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

export const groupBy = <T, K extends number | string | symbol>(
  fn: (value: T) => K,
  list: T[]
): Record<K, T[]> => {
  const addToGroup = (acc: Record<K, T[]>, value: T) => {
    const key = fn(value);
    let group = acc[key] ?? [];
    group = [...group, value];
    return R.assoc(key, group, acc);
  };
  return R.reduce(addToGroup, {} as Record<K, T[]>, list);
};

export const createFactory =
  <T>(base: T) =>
  (updates: Partial<T> = {}): T => {
    return {...base, ...updates};
  };

export const createFactoryWithCallback =
  <T>(base: () => T) =>
  (updates: Partial<T> = {}): T => {
    return {...base(), ...updates};
  };
export const wrap = <T>(x: T | T[] | undefined): T[] => {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  return [x];
};

export const last = R.nth(-1);
export const first = R.nth(0);
export const second = R.nth(1);
export const third = R.nth(2);
export const fourth = R.nth(3);
export const fifth = R.nth(4);
export const sixth = R.nth(5);
