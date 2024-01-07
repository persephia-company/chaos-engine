import {SystemResults} from '@/lib/system';
import {World} from '@/lib/world';
import {Key} from './updateable';
import {Entity} from './entity';

export type System = (world: World) => SystemResults<unknown>;

export type ChangeType = 'add' | 'delete' | 'set' | 'update';

export type SystemChange<T> = {
  method: ChangeType;
  path: Key[];
  value?: T | T[] | ((v: T) => T) | string | string[];
  ids?: Entity | Entity[];
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

export type QueryHandler<T extends any[]> = (
  request: QueryResponse<T>
) => SystemResults<any>;
