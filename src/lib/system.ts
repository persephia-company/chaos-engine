import {SystemChange, ChangeType, SystemResults} from '@/types/system';
import {createFactory} from './util';

import * as R from 'ramda';

const createSystemChange = <T>(
  method: ChangeType,
  path: (string | number | symbol)[],
  value: SystemChange<T>['value']
) => {
  return {method, path, value};
};

// TODO: very sus might have to check this works nicely
const createSystemResults: (updates?: Partial<SystemResults>) => SystemResults =
  createFactory<SystemResults>({
    changes: [],
    add(path, ...values) {
      return createSystemResults({
        changes: R.append(
          createSystemChange('add', path, values),
          this.changes
        ),
      });
    },
    set(path, ...values) {
      return createSystemResults({
        changes: R.append(
          createSystemChange('set', path, values),
          this.changes
        ),
      });
    },
    update(path, f) {
      return createSystemResults({
        changes: R.append(createSystemChange('update', path, f), this.changes),
      });
    },
    delete(path, ...values) {
      return createSystemResults({
        changes: R.append(
          createSystemChange('delete', path, values),
          this.changes
        ),
      });
    },
  });
