import {SystemChange, ChangeType} from '@/types/system';
import {createFactory} from './util';

import * as R from 'ramda';
import {Updateable} from '@/types/updateable';

export const createSystemChange = <T>(
  method: ChangeType,
  path: (string | number | symbol)[],
  value: SystemChange<T>['value']
) => {
  return {method, path, value};
};

// TODO: very sus might have to check this works nicely
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
