import {changeEventName} from '@/lib/systems';
import {ReservedKeys} from '@/lib/world';
import {
  AddComponentChange,
  Change,
  EventChange,
  SetComponentChange,
} from '@/types/change';
import {EntityID} from '@/types/entity';

export const createChangeEvent = (
  rawChange: Change<any>
): EventChange<Change> => {
  const key = rawChange.path[1];
  return {
    method: 'add',
    path: ['events', changeEventName(rawChange.method, key as string)],
    value: rawChange,
  };
};

export const createIDChangeEvent = <T>(
  change: AddComponentChange<T, EntityID> | SetComponentChange<T, EntityID>
) => ({
  method: change.method,
  path: ['components', ReservedKeys.ID],
  value: change.id!,
  id: change.id,
});
