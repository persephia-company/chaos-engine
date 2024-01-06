import {
  SystemChange,
  ChangeType,
  QueryRequest,
  QueryHandler,
} from '@/types/system';

import * as R from 'ramda';
import {Key, Updateable} from '@/types/updateable';
import {World} from '@/lib/world';

export const createSystemChange = <T>(
  method: ChangeType,
  path: Key[],
  value: SystemChange<T>['value']
) => {
  return {method, path, value};
};

export class SystemResults implements Updateable<unknown> {
  changes: SystemChange<unknown>[];

  constructor(changes: SystemChange<unknown>[] = []) {
    this.changes = changes;
  }

  addChange(change: SystemChange<unknown>): SystemResults {
    return new SystemResults([...this.changes, change]);
  }

  add(path: Key[], ...values: unknown[]): SystemResults {
    const change = createSystemChange('add', path, values);
    return this.addChange(change);
  }

  set(path: Key[], ...values: unknown[]): SystemResults {
    const change = createSystemChange('set', path, values);
    return this.addChange(change);
  }

  update(path: Key[], f: (value: unknown) => unknown): SystemResults {
    const change = createSystemChange('update', path, f);
    return this.addChange(change);
  }

  delete(path: Key[], ...values: unknown[]): SystemResults {
    const change = createSystemChange('delete', path, values);
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

    return handler({components, resources, events, options});
  };
