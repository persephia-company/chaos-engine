import {SystemResults} from '@/lib/system';
import {World} from './world';

export type System = (world: World) => SystemResults;

export type ChangeType = 'add' | 'delete' | 'set' | 'update';

export type SystemChange<T> = {
  method: ChangeType;
  path: (string | number | symbol)[];
  value?: T | T[] | ((v: T) => T);
};

export type QueryOptions = {};

export type QueryRequest = {
  components: string[];
  resources: string[];
  events: string[];
  options: Partial<QueryOptions>;
};

export type QueryResponse<T extends any[]> = {
  components: T[];
  resources: Record<string, unknown>;
  events: Record<string, unknown[]>;
  options: QueryOptions;
};

export type QueryHandler<T> = (request: QueryResponse<T>) => SystemResults;
