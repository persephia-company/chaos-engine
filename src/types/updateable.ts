export type Key = string | number;

export interface Updateable<T> {
  add(path: Key[], ...values: T[]): Updateable<T>;
  delete(path: Key[], ...values: T[]): Updateable<T>;
  update(path: Key[], f: (value: T) => T): Updateable<T>;
  set(path: Key[], ...values: T[]): Updateable<T>;
}
