import {logger} from '@/lib/logger';
import {Intention, changeEventName} from '@/lib/systems';
import {wrap} from '@/lib/util';
import {ReservedKeys, World} from '@/lib/world';
import {
  AddComponentChange,
  Change,
  DeleteComponentChange,
  SetComponentChange,
} from '@/types/change';
import {EntityID} from '@/types/entity';
import {System} from '@/types/system';

/**
 * Adds deleted entities to the revival queue to reclaim their id later.
 */
export const updateEntityRevivalQueue: System = async world => {
  const deletions = world.getEvents<DeleteComponentChange<EntityID>>(
    changeEventName('delete', ReservedKeys.ID)
  );
  if (!deletions.length) return;

  const deadIDs = deletions.map(change => change.id);

  const stack = world.getResource<Set<EntityID>>(
    ReservedKeys.ENTITY_REVIVAL_STACK
  );
  if (stack === undefined) {
    return new Intention().addResource(
      ReservedKeys.ENTITY_REVIVAL_STACK,
      new Set(deadIDs)
    );
  }

  return new Intention().updateResource(
    ReservedKeys.ENTITY_REVIVAL_STACK,
    (stack: Set<EntityID>) => {
      deadIDs.forEach(id => stack.add(id));
      return stack;
    }
  );
};

const getCreatedIds = (world: World) => {
  const addIds = world
    .getEvents<AddComponentChange<EntityID>>(
      changeEventName('add', ReservedKeys.ID)
    )
    .map(change => change.value);

  const setIds = world
    .getEvents<SetComponentChange<EntityID>>(
      changeEventName('set', ReservedKeys.ID)
    )
    .map(change => change.value);

  return addIds.concat(setIds);
};

/**
 * Keep track of entites who are created from the revival queue, and remove
 * them from the queue.
 */
export const reviveEntities: System = async world => {
  const ids = getCreatedIds(world);
  if (ids.length === 0) return;
  if (world.getResource(ReservedKeys.ENTITY_REVIVAL_STACK) === undefined)
    return;

  return new Intention().updateResource(
    ReservedKeys.ENTITY_REVIVAL_STACK,
    (stack: Set<EntityID>) => {
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
export const updateMaxID: System = async world => {
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
  let result = new Intention();

  if (max > currentMax) {
    result = result.setResource(ReservedKeys.MAX_ID, max);
  }

  return result;
};
