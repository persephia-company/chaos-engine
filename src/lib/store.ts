import ComponentStore from '@/types/store';
import {
  AddComponentChange,
  ChangeType,
  ComponentChange,
  SetComponentChange,
} from '@/types/change';

import {take, zip} from 'ramda';
import {logger} from './logger';
import {EntityID} from '@/types/entity';

/**
 * An implementation of a SparseSet which also stores a component.
 *
 * Stores only one component per entity id.
 */
export class SparseComponentStore<T> implements ComponentStore<T> {
  maxID: number;
  n: number;
  sparse: number[];
  dense: number[];
  components: T[];

  constructor(
    maxID = 2 ** 16,
    n = 0,
    sparse: number[] = [],
    dense: number[] = [],
    components: T[] = []
  ) {
    this.maxID = maxID;
    this.n = n;
    this.sparse = sparse;
    this.dense = dense;
    this.components = components;
  }

  /**
   * Return the number of components stored inside this store.
   */
  length(): number {
    return this.n;
  }

  private indexOf(id: number): number {
    return this.sparse[id];
  }

  /**
   * Returns true iff the entity with the suplied id exists within the set.
   *
   * @param id - The id of the entity to check for set membership.
   */
  hasEntity(id: EntityID): boolean {
    if (id > this.maxID) return false;
    return id === this.dense[this.sparse[id]];
  }

  /**
   * Inserts a component for a given entity.
   *
   * @param id - The id of an entity
   * @param component - The component to insert
   * @returns the Store, for use in chaining.
   *
   * @example
   * const store = new SparseComponentStore()
   * store.insert(1, "hello")
   */
  insert(id: EntityID, component: T): SparseComponentStore<T> {
    if (this.hasEntity(id)) {
      this.components[this.indexOf(id)] = component;
      return this;
    }
    // New component
    this.sparse[id] = this.n;
    this.dense[this.n] = id;
    this.components[this.n] = component;
    this.n += 1;
    return this;
  }

  /**
   * Returns the component associated with the Entity id, if stored.
   *
   * @param id - The id of an entity
   */
  getComponent(id: EntityID): T | undefined {
    return this.components[this.indexOf(id)];
  }

  /**
   * Returns all stored components.
   */
  getComponents(): T[] {
    return take(this.n, this.components);
  }

  /**
   * Returns a zipped list of <id, component> tuples
   */
  getItems(): [number, T][] {
    const n = take(this.n);
    return zip(n(this.dense), n(this.components));
  }

  /**
   * Removes the component associated with the supplied entity id,
   * if it exists.
   *
   * @param id - The id of an entity to remove.
   */
  remove(id: EntityID): SparseComponentStore<T> {
    if (!this.hasEntity(id)) return this;
    if (this.n === 1) {
      this.dense = [];
      this.sparse = [];
      this.components = [];
      this.n = 0;
      return this;
    }

    const lastIndex = this.n - 1;
    const oldID = this.indexOf(id);
    const replacementID = this.dense[lastIndex];
    const replacement = this.components[lastIndex];

    this.dense[oldID] = replacementID;
    this.sparse[replacementID] = oldID;
    this.components[oldID] = replacement;
    this.n -= 1;
    return this;
  }

  private logChangeError(
    method: ChangeType,
    message: string
  ): SparseComponentStore<T> {
    logger.error({
      msg: `Store ${method.toUpperCase()} failed`,
      reason: message,
    });
    return this;
  }

  private _add(
    change: AddComponentChange<T, EntityID> | SetComponentChange<T, EntityID>,
    overwrite = false
  ): SparseComponentStore<T> {
    const {method, id, value} = change;

    const logChangeError = (msg: string) => this.logChangeError(method, msg);

    if (id === undefined) {
      return logChangeError(`Missing id from change: ${change}`);
    }

    if (overwrite || !this.hasEntity(id)) {
      this.insert(id, value);
    }

    return this;
  }

  handleChange(change: ComponentChange<T, number>): SparseComponentStore<T> {
    switch (change.method) {
      case 'add':
        return this._add(change);
      case 'set':
        return this._add(change, true);
      case 'update':
        if (change.id === undefined) {
          this.components = this.components.map(change.fn);
        } else {
          const index = this.indexOf(change.id);
          this.components[index] = change.fn(this.components[index]);
        }
        return this;
      case 'delete':
        if (change.id === undefined) {
          return this.logChangeError('delete', 'Missing entity id');
        }
        return this.remove(change.id);
    }
  }
}
