import {logger} from '@/lib/logger';
import {SystemResults, changeEventName} from '@/lib/system';
import {wrap} from '@/lib/util';
import {RESOURCES, ReservedKeys} from '@/lib/world';
import {Entity} from '@/types/entity';
import {System, SystemChange} from '@/types/system';

/**
 * Adds deleted entities to the revival queue to reclaim their id later.
 */
export const reviveIDs: System = world => {
  const deletions = world.getEvents<SystemChange<Entity>>(
    changeEventName('delete', ReservedKeys.ID)
  );
  if (!deletions.length) return;

  const deadIDs = deletions.flatMap(change => wrap(change.ids));
  logger.info({msg: 'Dead IDs', deadIDs});
  const queuePath = [RESOURCES, ReservedKeys.ENTITY_REVIVAL_QUEUE];

  // TODO: This isn't working, looks like the next ids ignore the queue and pull from MAX_ID

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
  if (changes.length === 0) return;

  const ids = changes.flatMap(change => wrap(change.value) as Entity[]);
  const max = Math.max(...ids);

  const currentMax = world.getResourceOr(-1, ReservedKeys.MAX_ID);

  logger.debug({
    msg: 'Max ID check',
    currentMax,
    max,
    willUpdate: max > currentMax,
  });
  let result = new SystemResults();

  if (max > currentMax) {
    result = result.setResource(ReservedKeys.MAX_ID, max);
  }

  return result;
};
