import {logger} from '@/lib/logger';
import {SystemResults, changeEventName} from '@/lib/system';
import {wrap} from '@/lib/util';
import {ReservedKeys, World} from '@/lib/world';
import {Entity} from '@/types/entity';
import {System, SystemChange} from '@/types/system';

/**
 * Adds deleted entities to the revival queue to reclaim their id later.
 */
export const sendDeadEntitiesToPurgatory: System = world => {
  const deletions = world.getEvents<SystemChange<Entity>>(
    changeEventName('delete', ReservedKeys.ID)
  );
  if (!deletions.length) return;

  const deadIDs = deletions.flatMap(change => wrap(change.ids));

  const stack = world.getResource<Set<Entity>>(
    ReservedKeys.ENTITY_REVIVAL_STACK
  );
  if (stack === undefined) {
    return new SystemResults().addResource(
      ReservedKeys.ENTITY_REVIVAL_STACK,
      new Set(deadIDs)
    );
  }

  return new SystemResults().updateResource(
    ReservedKeys.ENTITY_REVIVAL_STACK,
    (stack: Set<Entity>) => {
      deadIDs.forEach(id => stack.add(id));
      return stack;
    }
  );
};

const getCreatedIds = (world: World) => {
  const addChanges = world.getEvents<SystemChange<Entity>>(
    changeEventName('add', 'id')
  );
  const setChanges = world.getEvents<SystemChange<Entity>>(
    changeEventName('set', 'id')
  );
  const changes = addChanges.concat(setChanges);
  return changes.flatMap(change => wrap(change.value) as Entity[]);
};

/**
 * Keep track of entites who are created from the revival queue, and remove
 * them from the queue.
 */
export const reviveEntities: System = world => {
  const ids = getCreatedIds(world);
  if (ids.length === 0) return;
  if (world.getResource(ReservedKeys.ENTITY_REVIVAL_STACK) === undefined)
    return;

  return new SystemResults().updateResource(
    ReservedKeys.ENTITY_REVIVAL_STACK,
    (stack: Set<Entity>) => {
      ids.forEach(id => stack.delete(id));
      return stack;
    }
  );
};

/**
 * Keeps the maximum ID up to date when new ids are created.
 *
 * Note: Seems like it should cause gaps, but reviveIDs should handle it.
 */
export const updateMaxID: System = world => {
  const ids = getCreatedIds(world);
  if (ids.length === 0) return;

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
