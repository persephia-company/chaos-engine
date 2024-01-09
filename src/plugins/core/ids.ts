import {SystemResults, changeEventName, defsys} from '@/lib/system';
import {wrap} from '@/lib/util';
import {ReservedKeys} from '@/lib/world';
import {Entity} from '@/types/entity';
import {SystemChange} from '@/types/system';

/**
 * Adds deleted entities to the revival queue to reclaim their id later.
 */
export const reviveIDs = defsys(
  {events: [changeEventName('delete', 'id')]},
  ({events}) => {
    const deadIDs = events[changeEventName('delete', 'id')] as Entity[];
    return new SystemResults().update(
      ['resources', ReservedKeys.ENTITY_REVIVAL_QUEUE],
      (q: Entity[]) => q.concat(deadIDs)
    );
  }
);

/**
 * Keeps the maximum ID up to date when new ids are created.
 *
 * Note: Seems like it should cause gaps, but reviveIDs should handle it.
 */
export const updateMaxID = defsys(
  {
    events: [changeEventName('add', 'id'), changeEventName('set', 'id')],
  },
  ({events}) => {
    const addChanges = events[
      changeEventName('add', 'id')
    ] as SystemChange<Entity>[];
    const setChanges = events[
      changeEventName('set', 'id')
    ] as SystemChange<Entity>[];

    const ids = addChanges
      .concat(setChanges)
      .flatMap(change => wrap(change.value) as Entity[]);
    const max = Math.max(...ids);

    return new SystemResults().update<Entity>(
      ['resources', ReservedKeys.MAX_ENTITY],
      id => Math.max(max, id)
    );
  }
);
