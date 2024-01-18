import {
  SystemChange,
  ChangeType,
  QueryRequest,
  QueryHandler,
  System,
} from '@/types/system';

import * as R from 'ramda';
import {Updateable} from '@/types/updateable';
import {World} from '@/lib/world';

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
}

export const defsys =
  <C extends any[]>(request: Partial<QueryRequest>, handler: QueryHandler<C>) =>
  (world: World) => {
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
    return Object.defineProperty(result, 'name', {value: system.name});
  }
);
