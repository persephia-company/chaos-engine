export interface Updateable<T> {
  add(path: string[], ...values: T[]): Updateable<T>;
  delete(path: string[], ...values: T[]): Updateable<T>;
  update(path: string[], f: (value: T) => T): Updateable<T>;
  set(path: string[], ...values: T[]): Updateable<T>;
}
