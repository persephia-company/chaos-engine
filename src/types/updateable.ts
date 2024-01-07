export type Key = string | number;

export interface Updateable<T> {
  add(path: Key[], values: T | T[], ids?: number | number[]): Updateable<T>; // needs id
  set(path: Key[], values: T | T[], ids?: number | number[]): Updateable<T>; // needs id
  delete(path: Key[], values?: T | T[], ids?: number | number[]): Updateable<T>; // needs id if component store but not otherwise
  update(
    path: Key[],
    f: (value: T) => T,
    ids?: number | number[]
  ): Updateable<T>; //
}
