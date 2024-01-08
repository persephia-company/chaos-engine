export type Key = string | number;

export interface Updateable<X, V = any> {
  add: <T extends V>(
    path: Key[],
    values: T | T[],
    ids?: number | number[]
  ) => X;
  set: <T extends V>(
    path: Key[],
    values: T | T[],
    ids?: number | number[]
  ) => X;
  delete: (
    path: Key[],
    values?: string | string[],
    ids?: number | number[]
  ) => X;
  update: <T extends V>(
    path: Key[],
    f: (value: V) => T,
    ids?: number | number[]
  ) => X; //
}
