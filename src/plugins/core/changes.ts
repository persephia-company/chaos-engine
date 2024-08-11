import {
  Intention,
  changeEventName,
  isChangeEvent,
  isComponentChange,
} from '@/lib/systems';
import {logger} from '@/lib/logger';
import {first, second, wrap} from '@/lib/util';
import {COMPONENTS, EVENTS, RESOURCES, ReservedKeys} from '@/lib/world';
import {System} from '@/types/system';
import {hasPath, zip} from 'ramda';
import {EntityID} from '@/types/entity';
import {DataType} from '@/types/world';
import {
  AddComponentChange,
  AddEventChange,
  Change,
  ChangeType,
  ComponentChange,
  DeleteComponentChange,
  EventChange,
  SetComponentChange,
} from '@/types/change';
import {ID, fixedID} from '@/lib/entity';

const createChangeEvent = (rawChange: Change<any>): EventChange<Change> => {
  const key = rawChange.path[1];
  return {
    method: 'add',
    path: ['events', changeEventName(rawChange.method, key as string)],
    value: rawChange,
  };
};

const createIDChangeEvent = <T>(
  change: AddComponentChange<T, EntityID> | SetComponentChange<T, EntityID>
) => ({
  method: change.method,
  path: ['components', ReservedKeys.ID],
  value: change.id!,
  id: change.id,
});

/**
 * Splits raw change events into per-key events that can be listened to individually.
 *
 * e.g. enables a user to listen to the "add-->player" event from other systems.
 * @see changeEventName for a useful utility here.
 *
 * This should be called after each batch so that the id systems can work properly, but
 * to do so, we have to keep track of how many events we've processed so far. We do this
 * by storing a resource (ReservedKeys.RAW_CHANGES_INDEX) which tracks the index up to
 * which we've already processed.
 */
export const addChangeEvents: System = async world => {
  const rawIndex = world.getResourceOr(0, ReservedKeys.RAW_CHANGES_INDEX);
  let rawChanges = world.getEvents<Change<unknown>>(ReservedKeys.RAW_CHANGES);
  const eventCount = rawChanges.length;

  // NOTE: Only add events we haven't already processed so far.
  rawChanges = rawChanges.slice(rawIndex);

  const indirectlyCreatesID = (rawChange: Change<unknown>): boolean => {
    if (!isComponentChange(rawChange)) return false;

    const componentName = rawChange.path[1];
    if (componentName === ReservedKeys.ID) {
      return false;
    }

    if (rawChange.method === 'update' || rawChange.method === 'delete') {
      return false;
    }

    return rawChange.id !== undefined;
  };

  const nonChangeEvents = rawChanges.filter(change => !isChangeEvent(change));

  // NOTE: Only make events for changes that arent already changeEvents
  const changeEvents = nonChangeEvents.map(change => createChangeEvent(change));

  // NOTE: Every change with an id is implicitly also a change event for ids
  const idChanges = nonChangeEvents
    .filter(indirectlyCreatesID)
    // @ts-ignore These types are hard to convince of.
    .map(createIDChangeEvent)
    // @ts-ignore These types are hard to convince of.
    .map(createChangeEvent);

  return new Intention()
    .addChanges(idChanges)
    .addChanges(changeEvents)
    .setResource(ReservedKeys.RAW_CHANGES_INDEX, eventCount);
};

export const entityDeletionCleanup: System = async world => {
  const deletionEvents = world.getEvents<DeleteComponentChange<EntityID>>(
    changeEventName('delete', ReservedKeys.ID)
  );
  const ids = deletionEvents.map(changeEvent => changeEvent.id);
  if (ids.length === 0) return;

  return new Intention().addEvents(ReservedKeys.ENTITY_DEATHS_DOORS, ids);
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
  logger.debug({msg: 'TO DIE', toDie, results});
  return results.resetEvents(ReservedKeys.ENTITY_DEATHS_DOORS);

  // TODO: Investigate if the above works for the below.
  //const changes = toDie.flatMap(id =>
  //  world
  //    .getComponentsForEntity(id)
  //    .filter(name => name !== ReservedKeys.ID)
  //    .map(name =>
  //      createSystemChange<unknown>('delete', [COMPONENTS, name], [], id)
  //    )
  //);
  //return new Intention(results.changes).setEvents(ReservedKeys.ENTITY_DEATHS_DOORS, []);
};

/**
 * Reset the raw change index to 0
 */
export const resetRawChangesIndex: System = async () => {
  return new Intention().setResource(ReservedKeys.RAW_CHANGES_INDEX, 0);
};

export const addModifiedEvents: System = async world => {
  const rawChanges = world.getEvents<Change<unknown>>(ReservedKeys.RAW_CHANGES);

  if (!rawChanges.length) return;

  const wouldModify = (change: Change<unknown>) => {
    return change.method !== 'delete';
  };

  const modifyingChanges = rawChanges
    .filter(wouldModify)
    .filter(change => !isChangeEvent(change));

  if (modifyingChanges.length === 0) return;

  const buildModifiedEvent = (
    change: Change<unknown>
  ): AddEventChange<Change<unknown>> => {
    const key = change.path[1];
    return {
      method: 'add',
      path: ['events', changeEventName('modified', key as string)],
      value: change,
    };
  };

  return new Intention(modifyingChanges.map(buildModifiedEvent));
};
