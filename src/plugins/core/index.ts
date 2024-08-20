import {World} from '@/lib/world';
import {ReservedStages} from '@/lib/keys';
import {idRecyclingPlugin} from './idRecycling';
import {changeEventPlugin} from './changeEvents';
import {System} from '@/types/system';
import {dependencyPlugin} from './dependencies';

/**
 * Adds essential library plugins to the world. The engine will not function as expected without calling this.
 */
export const corePlugin = (world: World): World => {
  return world
    .addSystem(resetEvents, ReservedStages.POST_STEP)

    .addPlugin(changeEventPlugin)
    .addPlugin(idRecyclingPlugin)
    .addPlugin(dependencyPlugin);
};

/**
 * Deletes all events from the world. Designed to be called at the end of each step.
 */
export const resetEvents: System = async world => {
  world.events = {};
};
