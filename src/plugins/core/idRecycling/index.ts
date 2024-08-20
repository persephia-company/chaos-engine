import {Plugin} from '@/types/world';
import {reviveEntities, updateEntityRevivalQueue} from './systems/recycling';
import {addChangeEvents} from '../changeEvents/systems/rawChangeEvents';
import {ReservedStages} from '@/lib/keys';
import {entityDeletionCleanup, executeEntities} from './systems/recycling';
import {updateMaxID} from './systems/maxID';
import {System} from '@/types/system';

export const anotherAddChangeEvents: System = async world =>
  addChangeEvents(world);

export const idRecyclingPlugin: Plugin = world => {
  return (
    world

      .addSystem(updateMaxID, ReservedStages.POST_BATCH)
      .addSystemDependency(updateMaxID, addChangeEvents)

      .addSystem(entityDeletionCleanup, ReservedStages.POST_BATCH)
      .addSystemDependency(entityDeletionCleanup, addChangeEvents)

      .addSystem(executeEntities, ReservedStages.POST_BATCH)
      .addSystemDependency(executeEntities, entityDeletionCleanup)

      // We really want all the updated change events to be available
      // immediately, so we do a second addchange events
      .addSystem(anotherAddChangeEvents, ReservedStages.POST_BATCH)
      .addSystemDependency(anotherAddChangeEvents, executeEntities)

      .addSystem(updateEntityRevivalQueue, ReservedStages.POST_BATCH)
      .addSystemDependency(updateEntityRevivalQueue, anotherAddChangeEvents)

      .addSystem(reviveEntities, ReservedStages.POST_BATCH)
      .addSystemDependency(reviveEntities, updateEntityRevivalQueue)
  );
};
