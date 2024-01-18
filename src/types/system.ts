import {SystemResults} from '@/lib/system';
import {World} from '@/lib/world';
import {Entity} from './entity';

// TODO: Make result optional
export type System = (world: World) => SystemResults;

export type ChangeType = 'add' | 'delete' | 'set' | 'update';

export type SystemChange<T = any> = {
  method: ChangeType;
  path: string[];
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
  world: World;
  components: T[];
  resources: Record<string, unknown>;
  events: Record<string, unknown[]>;
  options: QueryOptions;
};

export type QueryHandler<T extends any[]> = (
  request: QueryResponse<T>
) => SystemResults;
