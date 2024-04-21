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

  const isModifyingId = (rawChange: SystemChange<unknown>): boolean => {
    const key = rawChange.path[1];
    return wrap(rawChange.ids).length > 0 && key !== ReservedKeys.ID;
  };

  const nonChangeEvents = rawChanges.filter(change => !isChangeEvent(change));

  // NOTE: Only make events for changes that arent already changeEvents
  const changeEvents = nonChangeEvents.map(change => createChangeEvent(change));

  // NOTE: Every change with an id is implicitly also a change event for ids
  const idChanges = nonChangeEvents
    .filter(isModifyingId)
    .map(change => createIDChange(change.method, wrap(change.ids)))
    .map(change => createChangeEvent(change));

  return new SystemResults()
    .addChanges(idChanges)
    .addChanges(changeEvents)
    .setResource(ReservedKeys.RAW_CHANGES_INDEX, eventCount);
};

export const resetRawChangesIndex: System = world => {
  return new SystemResults().setResource(ReservedKeys.RAW_CHANGES_INDEX, 0);
};

/**
 * Checks for when data has been created for the first time.
 *
 * e.g. enables a user to listen to the "created:player" event from other systems.
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
