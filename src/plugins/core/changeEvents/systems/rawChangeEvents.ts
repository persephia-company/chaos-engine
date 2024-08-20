import {Intention, isChangeEvent, isComponentChange} from '@/lib/systems';
import {ReservedKeys} from '@/lib/world';
import {System} from '@/types/system';
import {Change} from '@/types/change';
import {createChangeEvent, createIDChangeEvent} from '../lib';

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

/**
 * Reset the raw change index to 0
 */
export const resetRawChangesIndex: System = async () => {
  return new Intention().setResource(ReservedKeys.RAW_CHANGES_INDEX, 0);
};
