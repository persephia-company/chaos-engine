import {EntityID} from './entity';

export interface ComponentStore<T> {
  hasEntity(id: EntityID): boolean;
  getComponent(id: EntityID): T | undefined;
  getComponents(): T[];
  getItems(): [EntityID, T][];
  insert(id: EntityID, component: T): ComponentStore<T>;
  remove(id: EntityID): ComponentStore<T>;
  length(): number;
}

export default ComponentStore;
