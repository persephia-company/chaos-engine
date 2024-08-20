import {System} from '@/types/system';
import {getCreatedIds} from '../lib';
import {logger} from '@/lib/logger';
import {Intention} from '@/lib/systems';
import {ReservedKeys} from '@/lib/keys';

/**
 * Keeps the maximum ID up to date when new ids are created.
 *
 * Note: Seems like it should cause gaps, but reviveIDs should handle it.
 */
export const updateMaxID: System = async world => {
  const ids = getCreatedIds(world);
  if (ids.length === 0) return;

  const max = Math.max(...ids);
  const currentMax = world.getResourceOr(-1, ReservedKeys.MAX_ID);

  logger.debug({
    msg: 'Max ID check',
    currentMax,
    max,
    willUpdate: max > currentMax,
  });
  let result = new Intention();

  if (max > currentMax) {
    result = result.setResource(ReservedKeys.MAX_ID, max);
  }

  return result;
};
