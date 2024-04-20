import {ReservedKeys, ReservedStages, World} from '@/lib/world';
import {describe, expect, test} from 'vitest';
import {SystemResults, Plugins, System} from '../..';
import {logger} from '@/lib/logger';
import {logNewRawChanges} from './debug';

const createWorld = () => {
  return new World()
    .addPlugin(Plugins.corePlugin)
    .addSystem(logNewRawChanges, ReservedStages.POST_BATCH);
};

const satisfiesInvariant = (world: World) => {
  return world instanceof World;
};

const COMPONENT = 'TEST';
const add: System = (world: World) => {
  return new SystemResults().addComponents(COMPONENT, 1);
};

const addToOne: System = (world: World) => {
  return new SystemResults().setComponents(COMPONENT, 1, 1);
};

const del: System = (world: World) => {
  return new SystemResults().deleteComponents(ReservedKeys.ID, [], [0, 1, 2]);
};

describe('Test id related plugins', () => {
  test('Adding an entity increases the max entity id', () => {
    let world = createWorld().addSystem(add);
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(-1);

    world = world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(0);

    world = world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(1);
    logger.info('HI');
  });
  test('Adding a component to an existing entity leaves the max id the same', () => {
    let world = createWorld().addSystem(addToOne);
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(-1);

    world = world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(1);

    world = world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(1);
  });
  test('Deleting the entity id component should remove it from all components', () => {});
  test('Deleting the entity id component should place it on the revival queue', () => {});
  test('New ids are taken first from the revival queue', () => {});
});
