import {SystemResults, changeEventName} from '@/lib/system';
import {wrap} from '@/lib/util';
import {ReservedKeys} from '@/lib/world';
import {Entity} from '@/types/entity';
import {System, SystemChange} from '@/types/system';

/**
 * Adds deleted entities to the revival queue to reclaim their id later.
 */
export const reviveIDs: System = world => {
  const deletions = world.getEvents<SystemChange<Entity>>(
    changeEventName('delete', 'id')
  );
  if (!deletions.length) return;

  const deadIDs = deletions.flatMap(change => wrap(change.ids));
  return new SystemResults()
    .add(['resources', ReservedKeys.ENTITY_REVIVAL_QUEUE], new Set())
    .update(
      ['resources', ReservedKeys.ENTITY_REVIVAL_QUEUE],
      (q: Set<Entity>) => {
        deadIDs.forEach(id => q.add(id));
        return q;
      }
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
  if (!changes.length) return;

  const ids = changes.flatMap(change => wrap(change.value) as Entity[]);
  const max = Math.max(...ids);

  return new SystemResults().update<Entity>(
    ['resources', ReservedKeys.MAX_ENTITY],
    id => Math.max(max, id)
  );
};
