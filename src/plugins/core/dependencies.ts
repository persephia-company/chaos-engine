import {logger} from '@/lib/logger';
import {Intention, changeEventName} from '@/lib/systems';
import {ReservedKeys, ReservedStages} from '@/lib/world';
import {SetResourceChange} from '@/types/change';
import {System} from '@/types/system';
import {Plugin} from '@/types/world';

export const dependencyPlugin: Plugin = world => {
  return world.addSystem(updateStageBatches, ReservedStages.PRE_BATCH);
};

export const updateStageBatches: System = async world => {
  const stageChangeEvents = world.getEvents<SetResourceChange<Set<string>>>(
    changeEventName('set', ReservedKeys.STAGE_CHANGES)
  );
  if (stageChangeEvents.length === 0) return;

  const changes = world.getResourceOr<Set<string>>(
    new Set(),
    ReservedKeys.STAGE_CHANGES
  );
  if (changes.size === 0) return;

  let batches = world.getResource<Record<string, System[][]>>(
    ReservedKeys.STAGE_BATCHES
  );
  logger.debug({
    msg: 'Updating stage batches.',
    changes,
    originalBatches: batches,
  });

  // If for whatever reason no stage batches exist, build them all.
  if (batches === undefined) {
    batches = world.buildAllStageBatches();
  } else {
    // Otherwise lets update all the changed stages
    batches = Array.from(changes.values()).reduce((result, stage) => {
      return {
        ...result,
        [stage]: world.buildStageBatches(stage),
      };
    }, batches);
  }

  return new Intention()
    .setResource(ReservedKeys.STAGE_BATCHES, batches)
    .deleteResource(ReservedKeys.STAGE_CHANGES);
};
