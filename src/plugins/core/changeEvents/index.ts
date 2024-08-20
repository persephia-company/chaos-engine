import {ReservedStages} from '@/lib/world';
import {Plugin} from '@/types/world';
import {addChangeEvents, resetRawChangesIndex} from './systems/rawChangeEvents';
import {addModifiedEvents} from './systems/modifiedEvents';

export const changeEventPlugin: Plugin = world => {
  return world
    .addSystem(resetRawChangesIndex, ReservedStages.PRE_STEP)

    .addSystem(addChangeEvents, ReservedStages.POST_BATCH)

    .addSystem(addModifiedEvents, ReservedStages.POST_BATCH)
    .addSystemDependency(addModifiedEvents, addChangeEvents);
};
