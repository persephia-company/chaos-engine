import {SystemResults} from '@/lib/system';
import {World} from '@/lib/world';
import {ReservedStages} from '@/lib/world';
import {reviveEntities, sendDeadEntitiesToPurgatory, updateMaxID} from './ids';
import {
  addChangeEvents,
  entityDeletionCleanup,
  executeEntities,
  resetRawChangesIndex,
} from './changes';
import {System} from '@/types/system';
import {logStage} from './debug';
import {logger} from '@/lib/logger';

/**
 * Adds essential library plugins to the world. The engine will not function as expected without calling this.
 */
export const corePlugin = (world: World): World => {
  // logger.info('Adding core plugins');
  return world
    .addSystem(resetRawChangesIndex, ReservedStages.PRE_STEP)
    .addSystem(resetEvents, ReservedStages.PRE_STEP)

    .addSystem(addChangeEvents, ReservedStages.POST_BATCH)

    .addSystem(sendDeadEntitiesToPurgatory, ReservedStages.POST_BATCH)
    .addSystemDependency(sendDeadEntitiesToPurgatory, addChangeEvents)

    .addSystem(reviveEntities, ReservedStages.POST_BATCH)
    .addSystemDependency(reviveEntities, addChangeEvents)

    .addSystem(updateMaxID, ReservedStages.POST_BATCH)
    .addSystemDependency(updateMaxID, addChangeEvents)

    .addSystem(entityDeletionCleanup, ReservedStages.POST_BATCH)
    .addSystemDependency(entityDeletionCleanup, addChangeEvents)

    .addSystem(executeEntities, ReservedStages.POST_BATCH)
    .addSystemDependency(executeEntities, entityDeletionCleanup);
};

/**
 * Plugins for diagnosing what's wrong with the system.
 */
export const debugPlugin = (world: World): World => {
  return world.addSystem(logStage, ReservedStages.PRE_STAGE);
};

/**
 * Deletes all events from the world. Designed to be called at the end of each step.
 */
const resetEvents: System = () => new SystemResults().set(['events'], {});
