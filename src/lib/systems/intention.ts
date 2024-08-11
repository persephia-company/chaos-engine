import {AddComponentChange, Change} from '@/types/change';
import {Entity, RealEntity, UnbornEntity} from '@/types/entity';
import {isFixed, isUnborn} from '../entity';
import {
  incrementChangeOffset,
  isComponentChange,
  replaceUnborn,
} from './change';

export class Intention {
  changes: Change<any, Entity>[];
  generatedIds: number;

  constructor(changes: Change<any, Entity>[] = [], generatedIds = 0) {
    this.changes = changes;
    this.generatedIds = generatedIds;
  }

  createID(): UnbornEntity {
    this.generatedIds += 1;
    const result: Entity = {exists: false, offset: this.generatedIds};
    return result;
  }

  createIDs(amount: number): UnbornEntity[] {
    const result: UnbornEntity[] = [];
    while (result.length < amount) {
      result.push(this.createID());
    }
    return result;
  }

  getUsedOffsets = () => {
    const result = new Set<number>();
    for (const change of this.changes) {
      if (
        isComponentChange(change) &&
        change.id !== undefined &&
        isUnborn(change.id)
      ) {
        result.add(change.id.offset);
      }
    }
    return result;
  };

  /*
   * Replaces all generated offset ids with the supplied offset
   * with the fixed id.
   */
  replaceAllUnborn(offset: number, fixedId: number) {
    this.changes = this.changes.map(change =>
      replaceUnborn(change, offset, fixedId)
    );
    return this;
  }

  /**
   * Creates and returns a new Intention with the additional change.
   *
   * It is assumed that any unborn entities contained in the supplied change are
   * using the same offset as this intention, i.e. they shouldn't change.
   */
  addChange<T>(change: Change<T, Entity>): Intention {
    // Adjust max offset if necessary
    if (
      isComponentChange(change) &&
      change.id !== undefined &&
      isUnborn(change.id) &&
      change.id.offset > this.generatedIds
    ) {
      // NOTE: We are causing gaps but preserving offset numbers here.
      // Another solution would be to generate the new change's offset ourself
      this.generatedIds = change.id.offset;
    }
    this.changes.push(change);
    return this;
  }

  /**
   * Creates and returns a new Intention with the additional changes.
   *
   * It is assumed that any unborn entities contained in the supplied changes are
   * using the same offset as this intention, i.e. they shouldn't change.
   */
  addChanges<T>(changes: Change<T, Entity>[]): Intention {
    for (const change of changes) {
      this.addChange(change);
    }
    return this;
  }

  /**
   * Combines the changes of two intentions, recalculating the offsets
   * of any unborn entities in the supplied intention so that they don't
   * overlap.
   *
   * Mutates the current Intention.
   */
  merge(results: Intention): Intention {
    // Need to increase all the offsets of the other results
    const changesWithOffset = results.changes.map(change =>
      incrementChangeOffset(change, this.generatedIds)
    );
    this.addChanges(changesWithOffset);
    //this.generatedIds += results.generatedIds;
    return this;
  }

  extractRealChanges(): Change<any, RealEntity>[] {
    return this.changes.filter(change => {
      if (!isComponentChange(change) || change.id === undefined) {
        return true;
      }
      return isFixed(change.id);
    }) as Change<any, RealEntity>[];
  }

  /**
   * Generate components for each k,v pair in the supplied bundle.
   *
   * Each component will have the supplied id, or will be grouped onto a
   * new entity if no id is supplied.
   */
  addBundle(bundle: Record<string, any>, id?: Entity) {
    if (id === undefined) {
      id = this.createID();
    }

    const createChange = <T>(component: string, value: T) =>
      ({
        path: ['components', component],
        value,
        id,
      }) as AddComponentChange<T, Entity>;

    const changes = Object.entries(bundle).map(([component, value]) =>
      createChange(component, value)
    );

    return this.addChanges(changes);
  }

  addComponent<T>(componentName: string, value: T, id?: Entity) {
    if (id === undefined) {
      id = this.createID();
    }

    return this.addChange({
      method: 'add',
      path: ['components', componentName],
      value,
      id,
    });
  }

  addComponents<T>(componentName: string, values: T[], ids?: Entity[]) {
    let result: Intention = this as Intention;
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const id = ids?.[i];
      result = result.addComponent(componentName, value, id);
    }
    return result;
  }

  setComponent<T>(componentName: string, value: T, id: Entity) {
    return this.addChange({
      method: 'set',
      path: ['components', componentName],
      value,
      id,
    });
  }

  setComponents<T>(componentName: string, values: T[], ids: Entity[]) {
    let result: Intention = this as Intention;
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const id = ids[i];
      result = result.setComponent(componentName, value, id);
    }
    return result;
  }

  deleteComponent(componentName: string, id: Entity) {
    return this.addChange({
      method: 'delete',
      path: ['components', componentName],
      id,
    });
  }

  deleteComponents(componentName: string, ids: Entity[]) {
    let result: Intention = this as Intention;
    for (const id of ids) {
      result = result.deleteComponent(componentName, id);
    }
    return result;
  }

  deleteAllComponentsOfName(componentName: string) {
    return this.addChange({
      method: 'delete',
      path: ['components', componentName],
    });
  }

  updateComponent<T>(
    componentName: string,
    fn: (value: T) => T,
    id: Entity
  ): Intention {
    return this.addChange({
      method: 'update',
      path: ['components', componentName],
      fn,
      id,
    });
  }

  updateComponents<T>(
    componentName: string,
    fn: (value: T) => T,
    ids?: Entity[]
  ): Intention {
    if (ids === undefined) {
      return this.addChange({
        method: 'update',
        path: ['components', componentName],
        fn,
      });
    }

    let result: Intention = this as Intention;
    for (const id of ids) {
      result = result.updateComponent(componentName, fn, id);
    }
    return result;
  }

  addResource<T>(resourceName: string, value: T) {
    return this.addChange({
      method: 'add',
      path: ['resources', resourceName],
      value,
    });
  }

  setResource<T>(resourceName: string, value: T) {
    return this.addChange({
      method: 'set',
      path: ['resources', resourceName],
      value,
    });
  }

  deleteResource(resourceName: string) {
    return this.addChange({
      method: 'delete',
      path: ['resources', resourceName],
    });
  }

  updateResource<T>(resourceName: string, fn: (value: T) => T): Intention {
    return this.addChange({
      method: 'update',
      path: ['resources', resourceName],
      fn,
    });
  }

  addEvent<T>(eventName: string, value: T) {
    return this.addChange({
      method: 'add',
      path: ['events', eventName],
      value,
    });
  }

  addEvents<T>(eventName: string, values: T[]) {
    let result: Intention = this as Intention;
    for (const value of values) {
      result = result.addEvent(eventName, value);
    }
    return result;
  }

  resetEvents(eventName: string) {
    return this.addChange({
      method: 'delete',
      path: ['events', eventName],
    });
  }

  deleteEvents(eventName: string) {
    return this.resetEvents(eventName);
  }
}
