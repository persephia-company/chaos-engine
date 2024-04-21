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
  return new SystemResults().deleteComponents(ReservedKeys.ID, [], [0, 1]);
};

describe('Test id related plugins', () => {
  test('Adding an entity increases the max entity id', () => {
    let world = createWorld().addSystem(add);
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(-1);

    world = world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(0);

    world = world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(1);
  });

  test('Adding a component to an existing entity leaves the max id the same', () => {
    let world = createWorld().addSystem(addToOne);
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(-1);

    world = world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(1);

    world = world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(1);
  });

  test('Deleting the entity id component should remove it from all components', () => {
    let world = createWorld().addSystem(addToOne);
    world = world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(1);
    expect(world.getComponentStore(COMPONENT).getComponent(1)).toBe(1);
    world = world.addSystem(del).addSystemDependency(del, addToOne);
    world = world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(1);
    expect(world.getComponentStore<number>(COMPONENT).getComponent(1)).toBe(
      undefined
    );
  });

  test('Deleting the entity id component should place it on the revival queue', () => {
    let world = createWorld().addSystem(add).step().step().step();
    logger.info('Three Steps!');

    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(2);
    world = world.addSystem(del, ReservedStages.PRE_STEP);
    world.applyStage(ReservedStages.PRE_STEP);

    const revivalQueue = world.getResourceOr(
      new Set(),
      ReservedKeys.ENTITY_REVIVAL_STACK
    );
    expect(revivalQueue.size).toBe(2);
    expect(revivalQueue.has(0)).true;
    expect(revivalQueue.has(1)).true;
  });

  test('New ids are taken first from the revival queue', () => {
    let world = createWorld().addSystem(add).step().step().step();
    logger.info('Three Steps!');

    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(2);
    world = world.addSystem(del).addSystemDependency(add, del);

    world.step();

    const revivalQueue = world.getResourceOr(
      new Set(),
      ReservedKeys.ENTITY_REVIVAL_STACK
    );
    expect(revivalQueue.size).toBe(1);

    // Shouldn't incrememnt maxID
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(2);
  });
});
