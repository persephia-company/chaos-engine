import {Entity} from './entity';

export type ChangeType = 'add' | 'delete' | 'set' | 'update';

export type ComponentPath = ['components', componentName: string];
export type EventPath = ['events', eventName: string];
export type ResourcePath = ['resources', resourceName: string];

export type ChangePath = ComponentPath | EventPath | ResourcePath;

export interface AddComponentChange<T, ID = Entity> {
  method: 'add';
  path: ComponentPath;
  value: T;
  id?: ID;
}

export interface UpdateComponentChange<T, ID = Entity> {
  method: 'update';
  path: ComponentPath;
  fn: (value: T) => T;
  id?: ID;
}

export interface SetComponentChange<T, ID = Entity> {
  method: 'set';
  path: ComponentPath;
  value: T;
  id: ID;
}

export interface DeleteComponentChange<ID = Entity> {
  method: 'delete';
  path: ComponentPath;
  id: ID;
}

export type ComponentChange<T, ID = Entity> =
  | AddComponentChange<T, ID>
  | UpdateComponentChange<T, ID>
  | SetComponentChange<T, ID>
  | DeleteComponentChange<ID>;

export interface AddResourceChange<T> {
  method: 'add';
  path: ResourcePath;
  value: T;
}

export interface UpdateResourceChange<T> {
  method: 'update';
  path: ResourcePath;
  fn: (value: T) => T;
}

export interface SetResourceChange<T> {
  method: 'set';
  path: ResourcePath;
  value: T;
}

export interface DeleteResourceChange {
  method: 'delete';
  path: ResourcePath;
}

export type ResourceChange<T> =
  | AddResourceChange<T>
  | UpdateResourceChange<T>
  | SetResourceChange<T>
  | DeleteResourceChange;

export interface AddEventChange<T> {
  method: 'add';
  path: EventPath;
  value: T;
}

export interface DeleteEventsChange {
  method: 'delete';
  path: EventPath;
}

export interface DeleteAllEventsChange {
  method: 'delete';
  path: ['events'];
}

export type EventChange<T> = AddEventChange<T> | DeleteEventsChange;

export type Change<T = any, ID = Entity> =
  | ComponentChange<T, ID>
  | ResourceChange<T>
  | EventChange<T>;

export interface Changeable<Result, T = any, ID = Entity> {
  handleChange: (change: Change<T, ID>) => Result;
}
