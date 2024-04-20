import {logger} from '@/lib/logger';
import {SystemResults, changeEventName} from '@/lib/system';
import {wrap} from '@/lib/util';
import {ReservedKeys} from '@/lib/world';
import {Entity} from '@/types/entity';
import {System, SystemChange} from '@/types/system';

/**
 * Adds deleted entities to the revival queue to reclaim their id later.
 */
export const reviveIDs: System = world => {
  const deletions = world.getEvents<SystemChange<Entity>>(
    changeEventName('delete', 'id')
  );
  if (!deletions.length) return;

  const deadIDs = deletions.flatMap(change => wrap(change.ids));
  const queuePath = ['resources', ReservedKeys.ENTITY_REVIVAL_QUEUE];
  return (
    new SystemResults()
      // Add a new resource if one doesn't already exist
      .add(queuePath, new Set())
      .update(queuePath, (q: Set<Entity>) => {
        deadIDs.forEach(id => q.add(id));
        return q;
      })
  );
};

/**
 * Keeps the maximum ID up to date when new ids are created.
 *
 * Note: Seems like it should cause gaps, but reviveIDs should handle it.
 */
export const updateMaxID: System = world => {
  const addChanges = world.getEvents<SystemChange<Entity>>(
    changeEventName('add', 'id')
  );
  const setChanges = world.getEvents<SystemChange<Entity>>(
    changeEventName('set', 'id')
  );
  const changes = addChanges.concat(setChanges);
  logger.debug({msg: 'Updating max id', setChanges, addChanges, changes});
  if (changes.length === 0) return;

  const ids = changes.flatMap(change => wrap(change.value) as Entity[]);
  const max = Math.max(...ids);

  const currentMax = world.getResourceOr(-1, ReservedKeys.MAX_ID);

  logger.debug({
    msg: 'Max ID check',
    currentMax,
    max,
    ids,
    willUpdate: max > currentMax,
  });
  let result = new SystemResults();

  if (max > currentMax) {
    result = result.setResource(ReservedKeys.MAX_ID, max);
  }

  return result;
};
