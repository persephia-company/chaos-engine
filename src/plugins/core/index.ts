import {SystemResults} from '@/lib/system';
import {EVENTS, World} from '@/lib/world';
import {ReservedStages} from '@/lib/world';
import {reviveEntities, updateEntityRevivalQueue, updateMaxID} from './ids';
import {
  addChangeEvents,
  addCreatedEvents,
  addModifiedEvents,
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
  return (
    world
      .addSystem(resetRawChangesIndex, ReservedStages.PRE_STEP)
      .addSystem(resetEvents, ReservedStages.PRE_STEP)

      // System changes
      .addSystem(addChangeEvents, ReservedStages.POST_BATCH)

      .addSystem(addCreatedEvents, ReservedStages.POST_BATCH)
      .addSystemDependency(addCreatedEvents, addChangeEvents)

      .addSystem(addModifiedEvents, ReservedStages.POST_BATCH)
      .addSystemDependency(addModifiedEvents, addChangeEvents)

      // Entity recycling systems
      .addSystem(updateEntityRevivalQueue, ReservedStages.POST_BATCH)
      .addSystemDependency(updateEntityRevivalQueue, addChangeEvents)

      .addSystem(reviveEntities, ReservedStages.POST_BATCH)
      .addSystemDependency(reviveEntities, addChangeEvents)

      .addSystem(updateMaxID, ReservedStages.POST_BATCH)
      .addSystemDependency(updateMaxID, addChangeEvents)

      .addSystem(entityDeletionCleanup, ReservedStages.POST_BATCH)
      .addSystemDependency(entityDeletionCleanup, addChangeEvents)

      .addSystem(executeEntities, ReservedStages.POST_BATCH)
      .addSystemDependency(executeEntities, entityDeletionCleanup)
  );
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
const resetEvents: System = async () => new SystemResults().set([EVENTS], {});
