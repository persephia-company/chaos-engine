import {
  SystemChange,
  ChangeType,
  QueryRequest,
  QueryHandler,
} from '@/types/system';

import * as R from 'ramda';
import {Updateable} from '@/types/updateable';
import {query} from './world';
import {World} from '@/types/world';

export const createSystemChange = <T>(
  method: ChangeType,
  path: (string | number | symbol)[],
  value: SystemChange<T>['value']
) => {
  return {method, path, value};
};

export class SystemResults implements Updateable<unknown> {
  changes: SystemChange<unknown>[];

  constructor(changes: SystemChange<unknown>[] = []) {
    this.changes = changes;
  }

  add(path: string[], ...values: unknown[]): SystemResults {
    const change = createSystemChange('add', path, values);
    return new SystemResults(R.append(change, this.changes));
  }

  set(path: string[], ...values: unknown[]): SystemResults {
    const change = createSystemChange('set', path, values);
    return new SystemResults(R.append(change, this.changes));
  }

  update(path: string[], f: (value: unknown) => unknown): SystemResults {
    const change = createSystemChange('update', path, f);
    return new SystemResults(R.append(change, this.changes));
  }

  delete(path: string[], ...values: unknown[]): SystemResults {
    const change = createSystemChange('delete', path, values);
    return new SystemResults(R.append(change, this.changes));
  }
}

export const defsys =
  <C extends any[]>(request: Partial<QueryRequest>, handler: QueryHandler<C>) =>
  (world: World) => {
    const components = request.components
      ? query<C>(world, request.components)
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
