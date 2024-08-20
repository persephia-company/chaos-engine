import {ReservedKeys} from '@/lib/keys';
import {logger} from '@/lib/logger';
import {System} from '@/types/system';

export const logNewRawChanges: System = async world => {
  const rawChangesIndex = world.getResourceOr(
    0,
    ReservedKeys.RAW_CHANGES_INDEX
  );
  const rawChanges = world.getEvents(ReservedKeys.RAW_CHANGES);
  const newChanges = rawChanges.slice(rawChangesIndex);

  if (newChanges.length > 0) {
    logger.debug({
      msg: 'New Raw Changes:',
      newRawChanges: newChanges,
    });
  }
};
