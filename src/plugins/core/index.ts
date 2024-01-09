import {
  SystemResults,
  changeEventName,
  createSystemChange,
  defsys,
} from '@/lib/system';
import {ReservedKeys, World} from '@/lib/world';
import {SystemChange} from '@/types/system';
import {ReservedStages} from '@/types/world';
import {reviveIDs, updateMaxID} from './ids';

/**
 * Adds essential library plugins to the world. The engine will not function as expected without calling this.
 */
export const addCorePlugins = (world: World) => {
  return world
    .addSystem(resetEvents, ReservedStages.POST_STEP)
    .addSystem(addChangeEvents, ReservedStages.POST_STAGE)
    .addSystem(reviveIDs, ReservedStages.POST_BATCH)
    .addSystem(updateMaxID, ReservedStages.POST_BATCH);
};

/**
 * Deletes all events from the world. Designed to be called at the end of each step.
 */
const resetEvents = defsys({}, () => new SystemResults().set(['events'], {}));

/**
 * Splits raw change events into per-key events that can be listened to individually.
 *
 * e.g. enables a user to listen to the "add:player" event from other systems.
 * @see changeEventName for a useful utility here.
 */
const addChangeEvents = defsys(
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
