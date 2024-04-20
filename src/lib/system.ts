import {
  SystemChange,
  ChangeType,
  QueryRequest,
  QueryHandler,
  System,
} from '@/types/system';

import * as R from 'ramda';
import {Updateable} from '@/types/updateable';
import {EVENTS, RESOURCES, World, COMPONENTS} from '@/lib/world';

/**
 * Returns the unique identifier used for changeEvents of a specific key and method.
 *
 * Useful in conjunction with @see defsys, to specify that a system is dependent on a
 * certain changeEvent, e.g. run this system every time the player's health changes.
 *
 * @example
 * defsys({events: [changeEventName('update', 'player-hp')]}, ...etc)
 */
export const changeEventName = (
  method: ChangeType | 'created' | 'modified',
  key: string
) => {
  return `${method}--${key}`;
};

export const createSystemChange = <T>(
  method: ChangeType,
  path: string[],
  value?: SystemChange<T>['value'],
  ids?: SystemChange<T>['ids']
): SystemChange<T> => {
  return {method, path, value, ids};
};

export class SystemResults implements Updateable<SystemResults> {
  changes: SystemChange<any>[];

  constructor(changes: SystemChange<any>[] = []) {
    this.changes = changes;
  }

  addChange<T>(change: SystemChange<T>): SystemResults {
    return new SystemResults([...this.changes, change]);
  }

  addChanges<T>(changes: SystemChange<T>[]): SystemResults {
    return this.merge(new SystemResults(changes));
  }

  merge(results: SystemResults): SystemResults {
    return new SystemResults(this.changes.concat(results.changes));
  }

  add<T>(
    path: string[],
    values: T | T[],
    ids?: number | number[]
  ): SystemResults {
    const change = createSystemChange('add', path, values, ids);
    return this.addChange(change);
  }

  set<T>(
    path: string[],
    values: T | T[],
    ids?: number | number[]
  ): SystemResults {
    const change = createSystemChange('set', path, values, ids);
    return this.addChange(change);
  }

  update<T>(
    path: string[],
    f: (value: T) => T,
    ids?: number | number[]
  ): SystemResults {
    const change = createSystemChange('update', path, f, ids);
    return this.addChange(change);
  }

  delete(
    path: string[],
    values?: string | string[],
    ids?: number | number[]
  ): SystemResults {
    const change = createSystemChange('delete', path, values, ids);
    return this.addChange(change);
  }

  addBundle(bundle: Record<string, any>, id?: number) {
    // TODO: Figure out how to share a non-specified id without world.
    const createChange = (component: string, value: any) =>
      createSystemChange('add', ['components', component], value, id);

    const changes = Object.entries(bundle).map(([component, value]) =>
      createChange(component, value)
    );
    return this.addChanges(changes);
  }

  addComponents<T>(
    componentName: string,
    values: T | T[],
    ids?: number | number[]
  ) {
    const path = [COMPONENTS, componentName];
    return this.add(path, values, ids);
  }

  setComponents<T>(
    componentName: string,
    values: T | T[],
    ids?: number | number[]
  ) {
    const path = [COMPONENTS, componentName];
    return this.set(path, values, ids);
  }

  deleteComponents(
    componentName: string,
    values: string | string[],
    ids?: number | number[]
  ) {
    const path = [COMPONENTS, componentName];
    return this.delete(path, values, ids);
  }

  updateComponents<T>(
    componentName: string,
    f: (value: T) => T,
    ids?: number | number[]
  ): SystemResults {
    const path = [COMPONENTS, componentName];
    return this.update(path, f, ids);
  }

  addResource<T>(
    resourceName: string,
    value: T | T[],
    ids?: number | number[]
  ) {
    const path = [RESOURCES, resourceName];
    return this.add(path, value, ids);
  }

  setResource<T>(
    resourceName: string,
    values: T | T[],
    ids?: number | number[]
  ) {
    const path = [RESOURCES, resourceName];
    return this.set(path, values, ids);
  }

  deleteResource(
    resourceName: string,
    values: string | string[],
    ids?: number | number[]
  ) {
    const path = [RESOURCES, resourceName];
    return this.delete(path, values, ids);
  }

  updateResource<T>(
    resourceName: string,
    f: (value: T) => T,
    ids?: number | number[]
  ): SystemResults {
    const path = [RESOURCES, resourceName];
    return this.update(path, f, ids);
  }

  addEvents<T>(eventName: string, values: T | T[], ids?: number | number[]) {
    const path = [EVENTS, eventName];
    return this.add(path, values, ids);
  }

  setEvents<T>(eventName: string, values: T | T[], ids?: number | number[]) {
    const path = [EVENTS, eventName];
    return this.set(path, values, ids);
  }

  deleteEvents(
    eventName: string,
    values: string | string[],
    ids?: number | number[]
  ) {
    const path = [EVENTS, eventName];
    return this.delete(path, values, ids);
  }

  updateEvents<T>(
    eventName: string,
    f: (value: T) => T,
    ids?: number | number[]
  ): SystemResults {
    const path = [EVENTS, eventName];
    return this.update(path, f, ids);
  }
}

export const defsys = <C extends any[]>(
  request: Partial<QueryRequest>,
  handler: QueryHandler<C>,
  name = 'anonymousSystem'
) => {
  const result = (world: World) => {
    const components = request.components
      ? world.query<C>(request.components)
      : [];
    const resources = R.pick(request.resources ?? [], world.resources);
    const events = R.pick(request.events ?? [], world.events);
    const options = request.options ?? {};

    // If this system depends on events that we don't have, exit.
    if (
      request.events &&
      request.events.length > 0 &&
      R.none(a => a.length > 0, Object.values(events))
    ) {
      return new SystemResults();
    }

    return handler({components, resources, events, options, world});
  };
  return nameSystem(name, result);
};

/**
 * Overwrites the function name for the system.
 *
 * Useful for when naming is obscured by closures.
 */
export const nameSystem = (name: string, system: System) => {
  return Object.defineProperty(system, 'name', {value: name});
};

/**
 * A decorator for a system which specifies that the system should only be run
 * when the system has events of the supplied names. Otherwise, it returns some
 * empty system results.
 *
 * Curries its arguments for further modularity.
 *
 * @example
 * const onTick = requireEvents(['tick'])
 *
 * let system = () => {
 *  console.log('hi')
 *  return new SystemResults();
 * }
 *
 * system = onTick(system); // now system will only run whenever a 'tick' event is detected
 */
export const requireEvents = R.curry(
  (eventNames: string[], system: System): System => {
    const result = (world: World) => {
      if (eventNames.some(name => world.getEvents(name).length > 0)) {
        return system(world);
      }
      return new SystemResults();
    };
    // Force the returned system to have the same name as the incoming one.
    return nameSystem(system.name, result);
  }
);
