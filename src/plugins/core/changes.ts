import {
  SystemResults,
  changeEventName,
  createSystemChange,
  defsys,
} from '@/lib/system';
import {first, second, wrap} from '@/lib/util';
import {ReservedKeys} from '@/lib/world';
import {SystemChange} from '@/types/system';
import {hasPath, zip} from 'ramda';

/**
 * Splits raw change events into per-key events that can be listened to individually.
 *
 * e.g. enables a user to listen to the "add:player" event from other systems.
 * @see changeEventName for a useful utility here.
 */
export const addChangeEvents = defsys(
  {events: [ReservedKeys.RAW_CHANGES]},
  ({events}) => {
    const rawChanges = (events[ReservedKeys.RAW_CHANGES] ??
      []) as SystemChange<unknown>[];

    const buildChange = (rawChange: SystemChange<unknown>) => {
      const key = rawChange.path[1];
      return createSystemChange(
        'add',
        ['events', changeEventName(rawChange.method, key as string)],
        rawChange
      );
    };

    return new SystemResults(rawChanges.map(buildChange));
  }
);

/**
 * Checks for when data has been created for the first time.
 *
 * e.g. enables a user to listen to the "created:player" event from other systems.
 * @see changeEventName for a useful utility here.
 */
export const addCreatedEvents = defsys(
  {events: [ReservedKeys.RAW_CHANGES]},
  ({events, world}) => {
    const rawChanges = (events[ReservedKeys.RAW_CHANGES] ??
      []) as SystemChange[];

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
  }
);

// TODO: add modified events as well
