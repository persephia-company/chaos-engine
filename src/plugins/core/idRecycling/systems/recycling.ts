import {Intention} from '@/lib/systems';
import {EntityID} from '@/types/entity';
import {System} from '@/types/system';
import {ID} from '@/lib/entity';
import {getCreatedIds, getDeletedIDs} from '../lib';
import {ReservedKeys} from '@/lib/keys';

/**
 * Adds deleted entities to the revival queue to reclaim their id later.
 */
export const updateEntityRevivalQueue: System = async world => {
  const deletedIDs = getDeletedIDs(world);
  if (deletedIDs.length === 0) return;

  const stack = world.getResourceOr<Set<EntityID>>(
    new Set(),
    ReservedKeys.ENTITY_REVIVAL_STACK
  );

  deletedIDs.forEach(id => stack.add(id));
  return new Intention().setResource(ReservedKeys.ENTITY_REVIVAL_STACK, stack);
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

export const entityDeletionCleanup: System = async world => {
  const deletedIDs = getDeletedIDs(world);
  if (deletedIDs.length === 0) return;
  return new Intention().addEvents(
    ReservedKeys.ENTITY_DEATHS_DOORS,
    deletedIDs
  );
};

/**
 * Executes all entities that have just had their ids deleted.
 *
 * This deletes all their components.
 */
export const executeEntities: System = async world => {
  const toDie = world.getEvents<EntityID>(ReservedKeys.ENTITY_DEATHS_DOORS);

  if (toDie.length === 0) return;

  let results = new Intention();
  for (const id of toDie) {
    const components = world.getComponentsForEntity(id);
    for (const component of components) {
      if (component !== ReservedKeys.ID) {
        results = results.deleteComponent(component, ID.real(id));
      }
    }
  }
  results = results.resetEvents(ReservedKeys.ENTITY_DEATHS_DOORS);
  return results;
};
