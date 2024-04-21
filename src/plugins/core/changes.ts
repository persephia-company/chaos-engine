import {
  SystemResults,
  changeEventName,
  createSystemChange,
  isChangeEvent,
} from '@/lib/system';
import {logger} from '@/lib/logger';
import {first, second, wrap} from '@/lib/util';
import {COMPONENTS, EVENTS, ReservedKeys} from '@/lib/world';
import {ChangeType, System, SystemChange} from '@/types/system';
import {hasPath, zip} from 'ramda';
import {Entity} from '@/types/entity';

const createChangeEvent = (
  rawChange: SystemChange<any>
): SystemChange<SystemChange> => {
  const key = rawChange.path[1];
  return createSystemChange(
    'add',
    [EVENTS, changeEventName(rawChange.method, key as string)],
    rawChange
  );
};

const createIDChange = (method: ChangeType, ids: number[]) => {
  return createSystemChange(method, [COMPONENTS, ReservedKeys.ID], ids, ids);
};

/**
 * Splits raw change events into per-key events that can be listened to individually.
 *
 * e.g. enables a user to listen to the "add--player" event from other systems.
 * @see changeEventName for a useful utility here.
 *
 * This should be called after each batch so that the id systems can work properly, but
 * to do so, we have to keep track of how many events we've processed so far. We do this
 * by storing a resource (ReservedKeys.RAW_CHANGES_INDEX) which tracks the index up to
 * which we've already processed.
 */
export const addChangeEvents: System = world => {
  const rawIndex = world.getResourceOr(0, ReservedKeys.RAW_CHANGES_INDEX);
  let rawChanges = world.getEvents<SystemChange<unknown>>(
    ReservedKeys.RAW_CHANGES
  );
  const eventCount = rawChanges.length;
  // NOTE: Only add events we haven't already processed so far.
  rawChanges = rawChanges.slice(rawIndex);

  const indirectlyCreatesID = (rawChange: SystemChange<unknown>): boolean => {
    if (rawChange.path[0] !== COMPONENTS) return false;

    const component = rawChange.path[1];
    if (component === ReservedKeys.ID) {
      return false;
    }

    if (!['add', 'set'].includes(rawChange.method)) {
      return false;
    }

    return wrap(rawChange.ids).length > 0;
  };

  const nonChangeEvents = rawChanges.filter(change => !isChangeEvent(change));

  // NOTE: Only make events for changes that arent already changeEvents
  const changeEvents = nonChangeEvents.map(change => createChangeEvent(change));

  // NOTE: Every change with an id is implicitly also a change event for ids
  const idChanges = nonChangeEvents
    .filter(indirectlyCreatesID)
    .map(change => createIDChange(change.method, wrap(change.ids)))
    .map(change => createChangeEvent(change));

  return new SystemResults()
    .addChanges(idChanges)
    .addChanges(changeEvents)
    .setResource(ReservedKeys.RAW_CHANGES_INDEX, eventCount);
};

export const entityDeletionCleanup: System = world => {
  const deletionEvents = world.getEvents<SystemChange<Entity>>(
    changeEventName('delete', ReservedKeys.ID)
  );
  const ids = deletionEvents.flatMap(changeEvent => wrap(changeEvent.ids));
  if (ids.length === 0) return;

  return new SystemResults().addEvents(
    ReservedKeys.ENTITY_DEATHS_DOORS,
    ids,
    ids
  );
};

export const executeEntities: System = world => {
  const toDie = world.getEvents<Entity>(ReservedKeys.ENTITY_DEATHS_DOORS);
  if (toDie.length === 0) return;

  let results = new SystemResults();
  for (const id of toDie) {
    const components = world.getComponentsForEntity(id);
    for (const component of components) {
      if (component !== ReservedKeys.ID) {
        results = results.deleteComponents(component, [], id);
      }
    }
  }
  const changes = toDie.flatMap(id =>
    world
      .getComponentsForEntity(id)
      .filter(name => name !== ReservedKeys.ID)
      .map(name =>
        createSystemChange<unknown>('delete', [COMPONENTS, name], [], id)
      )
  );
  logger.debug({msg: 'TO DIE', toDie, changes, results});
  return new SystemResults(changes).setEvents(
    ReservedKeys.ENTITY_DEATHS_DOORS,
    []
  );
};

/**
 * Reset the raw change index to 0
 */
export const resetRawChangesIndex: System = () => {
  return new SystemResults().setResource(ReservedKeys.RAW_CHANGES_INDEX, 0);
};

/**
 * Checks for when data has been created for the first time.
 *
 * e.g. enables a user to listen to the "created-->player" event from other systems.
 * @see changeEventName for a useful utility here.
 */
export const addCreatedEvents: System = world => {
  const rawChanges = world.getEvents<SystemChange<unknown>>(
    ReservedKeys.RAW_CHANGES
  );

  if (!rawChanges.length) return;

  const generateCreatedChanges = (
    rawChange: SystemChange
  ): SystemChange | undefined => {
    const {method, path} = rawChange;
    if (method !== 'set' && method !== 'add') {
      return;
    }

    const values = wrap(rawChange.value);
    const ids = wrap(rawChange.ids);

    if (path[0] === 'components') {
      const component = path[1];
      const created = zip(ids, values).filter(([id, _]) =>
        world.getComponentStore(component as string).hasEntity(id)
      );
      const createdIDs = created.map(first) as number[];
      const createdValues = created.map(second);

      return {...rawChange, value: createdValues, ids: createdIDs};
    }

    // TODO: This isn't exactly right but should be good enough for now.
    // NOTE: Maybe this should only generate events for components
    if (!hasPath(path as string[], world)) {
      return rawChange;
    }

    return;
  };

  const changes = rawChanges
    .map(generateCreatedChanges)
    .filter(change => change !== undefined) as SystemChange[];

  const buildCreatedEvent = (change: SystemChange<unknown>) => {
    const key = change.path[1];
    return createSystemChange(
      'add',
      ['events', changeEventName('created', key as string)],
      change
    );
  };

  return new SystemResults(changes.map(buildCreatedEvent));
};

// TODO: add modified events as well
