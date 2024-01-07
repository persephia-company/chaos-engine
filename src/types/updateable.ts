export type Key = string | number;

export interface Updateable<T> {
  add(path: Key[], values: T | T[], ids?: number | number[]): Updateable<T>;
  set(path: Key[], values: T | T[], ids?: number | number[]): Updateable<T>;
  delete(
    path: Key[],
    values?: string | string[],
    ids?: number | number[]
  ): Updateable<T>;
  update(
    path: Key[],
    f: (value: T) => T,
    ids?: number | number[]
  ): Updateable<T>; //
}
