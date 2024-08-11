import {Intention} from '@/lib/systems';
import {World} from '@/lib/world';

// TODO: Make result optional
export type System = (world: World) => Promise<Intention | void>;

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
) => Intention;
