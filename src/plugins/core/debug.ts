import {ReservedKeys} from '@/lib/world';
import {System} from '@/types/system';

export const logStage: System = world => {
  console.log(world.getResource<string>(ReservedKeys.STAGE));
};
