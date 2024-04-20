import ComponentStore from '@/types/store';
import {Updateable} from '@/types/updateable';

import {take, zip} from 'ramda';
import {wrap} from './util';
import {ChangeType} from '@/types/system';
import {createSystemChange} from './system';

/**
 * An implementation of a SparseSet which also stores a component.
 *
 * Stores only one component per entity id.
 */
export class SparseComponentStore<T>
  implements Updateable<SparseComponentStore<T>, T>, ComponentStore<T>
{
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
  hasEntity(id: number): boolean {
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
  insert(id: number, component: T): SparseComponentStore<T> {
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
  getComponent(id: number): T | undefined {
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
  remove(id: number): SparseComponentStore<T> {
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
    console.error(`${method.toUpperCase()} failed: ${message}`);
    return this;
  }

  private _add(
    method: 'add' | 'set',
    path: string[],
    values: T | T[],
    ids?: number | number[],
    overwrite = false
  ): SparseComponentStore<T> {
    const change = createSystemChange(method, path, values, ids);
    const logChangeError = (msg: string) => this.logChangeError(method, msg);
    if (path.length > 0) {
      return logChangeError(
        `Encountered unexpected path in component store: ${change}`
      );
    }
    const idList = wrap(ids);
    if (idList.length === 0) {
      return logChangeError(`Missing ids from message: ${change}`);
    }

    const vals = wrap(values);
    if (idList.length !== vals.length) {
      return logChangeError(
        `Mismatched length of ids and values -> ${idList.length} != ${vals.length} in ${change}`
      );
    }

    zip(idList, vals).forEach(([id, val]) => {
      if (overwrite || !this.hasEntity(id)) {
        this.insert(id, val);
      }
    });

    return this;
  }

  // NOTE: The typing here is gross but has to be done to
  // satisfy the interface. Makes me wonder...
  add<U extends T>(
    path: string[],
    values: U | U[],
    ids?: number | number[]
  ): SparseComponentStore<T> {
    return this._add('add', path, values, ids, false);
  }

  set<U extends T>(
    path: string[],
    values: U | U[],
    ids?: number | number[]
  ): SparseComponentStore<T> {
    return this._add('set', path, values as T | T[], ids, true);
  }

  update<U extends T>(
    path: string[],
    f: (value: T) => U,
    ids?: number | number[]
  ): SparseComponentStore<T> {
    const logChangeError = (msg: string) => this.logChangeError('update', msg);
    if (path.length > 0) {
      return logChangeError(
        `Encountered unexpected path in component store: ${path}`
      );
    }
    const idList = wrap(ids);
    if (!idList.length) {
      this.components = this.components.map(f);
      return this;
    }

    idList.forEach(id => {
      const index = this.indexOf(id);
      this.components[index] = f(this.components[index]);
    });
    return this;
  }

  delete(
    path: string[],
    values?: string | string[],
    ids?: number | number[]
  ): SparseComponentStore<T> {
    const logChangeError = (msg: string) => this.logChangeError('delete', msg);
    if (path.length > 0) {
      return logChangeError(
        `Encountered unexpected path in component store: ${path}`
      );
    }
    if (wrap(values).length > 0) {
      return logChangeError(
        `Encountered unexpected values in message: ${values}`
      );
    }

    wrap(ids).forEach(id => this.remove(id));
    return this;
  }
}
