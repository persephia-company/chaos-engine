import {Intention, changeEventName, isChangeEvent} from '@/lib/systems';
import {ReservedKeys} from '@/lib/world';
import {AddEventChange, Change} from '@/types/change';
import {System} from '@/types/system';

/**
 * Add change events for "modified" events.
 *
 * Modified events are a catch-all for any of the regular change types,
 * i.e. add, set, update and delete. The idea is that sometimes its useful just
 * to know that something was changed at all.
 */
export const addModifiedEvents: System = async world => {
  const rawChanges = world.getEvents<Change<unknown>>(ReservedKeys.RAW_CHANGES);

  if (!rawChanges.length) return;

  const modifyingChanges = rawChanges.filter(change => !isChangeEvent(change));

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
