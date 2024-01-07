import {SystemResults, defsys} from '@/lib/system';
import {World} from '@/lib/world';
import {ReservedStages} from '@/types/world';

/**
 * Deletes all events from the world. Designed to be called at the end of each step.
 */
const resetEvents = defsys({}, () => new SystemResults().set(['events'], {}));

/**
 * Adds essential library plugins to the world. The engine will not function as expected without calling this.
 */
export const addCorePlugins = (world: World) => {
  return world.addSystem(resetEvents, ReservedStages.POST_STEP);
};
