import {logger} from '@/lib/logger';
import {changeEventName} from '@/lib/systems';
import {ReservedKeys, World} from '@/lib/world';
import {
  AddComponentChange,
  DeleteComponentChange,
  SetComponentChange,
} from '@/types/change';
import {EntityID} from '@/types/entity';

export const getCreatedIds = (world: World) => {
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

export const getDeletedIDs = (world: World): EntityID[] => {
  const idDeletionEvents = world.getEvents<DeleteComponentChange<EntityID>>(
    changeEventName('delete', ReservedKeys.ID)
  );
  if (!idDeletionEvents.length) return [];

  const deadIDs = idDeletionEvents
    .filter(change => change.id !== undefined)
    .map(change => change.id) as number[];

  // If a delete all event occurred find all remaining ids within all the stores.
  if (deadIDs.length !== idDeletionEvents.length) {
    return Object.values(world.components).flatMap(store =>
      store.getItems().map(([id]) => id)
    );
  }

  return deadIDs;
};
