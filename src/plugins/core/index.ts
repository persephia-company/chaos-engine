import {SystemResults} from '@/lib/system';
import {World} from '@/lib/world';
import {ReservedStages} from '@/types/world';
import {reviveIDs, updateMaxID} from './ids';
import {addChangeEvents} from './changes';
import {System} from '@/types/system';
import {logStage} from './debug';

/**
 * Adds essential library plugins to the world. The engine will not function as expected without calling this.
 */
export const corePlugin = (world: World): World => {
  return world
    .addSystem(addChangeEvents, ReservedStages.POST_STEP)
    .addSystem(resetEvents, ReservedStages.POST_STEP)
    .addSystemDependency(resetEvents, addChangeEvents)
    .addSystem(reviveIDs, ReservedStages.POST_BATCH)
    .addSystem(updateMaxID, ReservedStages.POST_BATCH);
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
