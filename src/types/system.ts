import {Updateable} from './updateable';
import {World} from './world';

export type System = (world: World) => SystemResults;

export interface SystemResults extends Updateable<unknown> {
  changes: SystemChange<unknown>[];
}

export type ChangeType = 'add' | 'delete' | 'set' | 'update';

export type SystemChange<T> = {
  method: ChangeType;
  path: (string | number | symbol)[];
  value?: T | T[] | ((v: T) => T);
};
