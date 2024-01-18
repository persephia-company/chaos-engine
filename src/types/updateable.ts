export interface Updateable<X, V = any> {
  add: <T extends V>(
    path: string[],
    values: T | T[],
    ids?: number | number[]
  ) => X;
  set: <T extends V>(
    path: string[],
    values: T | T[],
    ids?: number | number[]
  ) => X;
  delete: (
    path: string[],
    values?: string | string[],
    ids?: number | number[]
  ) => X;
  update: <T extends V>(
    path: string[],
    f: (value: V) => T,
    ids?: number | number[]
  ) => X; //
}
